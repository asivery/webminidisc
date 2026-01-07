use std::cell::Cell;
use std::cmp::Ordering;

const DOUBLE_MANTISSA_BITS: u32 = 52;
const DOUBLE_EXP_BIAS: i32 = 1023;
const DOUBLE_IMPLICIT_BIT: u64 = 1u64 << DOUBLE_MANTISSA_BITS;

const SIGN_MASK: u16 = 0x8000;
const EXP_MASK: u16 = 0x7FFF;
const EXP_BIAS: i32 = 0x3FFF;
const IMPLIED_BIT: u64 = 1u64 << 63;
const MANTISSA_SCALE: f64 = 9_223_372_036_854_775_808.0; // 2^63
const MANTISSA_INV: f64 = 1.0 / MANTISSA_SCALE;

const FLAG_INVALID_OP: u8 = 1 << 0;
const FLAG_DIV_ZERO: u8 = 1 << 2;
const FLAG_OVERFLOW: u8 = 1 << 3;
const FLAG_UNDERFLOW: u8 = 1 << 4;
const FLAG_PRECISION: u8 = 1 << 5;

thread_local! {
    static ROUNDING_MODE: Cell<u8> = Cell::new(0);
    static PRECISION_MODE: Cell<u8> = Cell::new(80);
    static EXCEPTION_FLAGS: Cell<u8> = Cell::new(0);
}

fn raise_flags(bits: u8) {
    if bits != 0 {
        EXCEPTION_FLAGS.with(|flags| flags.set(flags.get() | bits));
    }
}

fn clear_flags() {
    EXCEPTION_FLAGS.with(|flags| flags.set(0));
}

fn current_rounding_mode() -> u8 {
    ROUNDING_MODE.with(|mode| mode.get())
}

fn pow2(exp: i32) -> f64 {
    if exp > 1023 {
        f64::INFINITY
    } else if exp < -1074 {
        0.0
    } else if exp >= -1022 {
        let bits = ((exp + DOUBLE_EXP_BIAS) as u64) << 52;
        f64::from_bits(bits)
    } else {
        let shift = (-1023 - exp) as u32;
        let mantissa = 1u64 << (51 - shift);
        f64::from_bits(mantissa)
    }
}

fn encode_from_f64(value: f64) -> F80 {
    if value.is_nan() {
        return F80::INDEFINITE_NAN;
    }

    if value == 0.0 {
        let sign = if value.is_sign_negative() { SIGN_MASK } else { 0 };
        return F80 {
            mantissa: 0,
            sign_exponent: sign,
        };
    }

    if value.is_infinite() {
        let sign = if value.is_sign_negative() { SIGN_MASK } else { 0 };
        return F80 {
            mantissa: IMPLIED_BIT,
            sign_exponent: sign | EXP_MASK,
        };
    }

    let sign = if value.is_sign_negative() { SIGN_MASK } else { 0 };
    let bits = value.to_bits();
    let exp_field = ((bits >> DOUBLE_MANTISSA_BITS) & 0x7FF) as i32;
    let frac = bits & ((1u64 << DOUBLE_MANTISSA_BITS) - 1);

    if exp_field != 0 {
        let mantissa = (frac | DOUBLE_IMPLICIT_BIT) << (63 - DOUBLE_MANTISSA_BITS);
        let biased = exp_field - DOUBLE_EXP_BIAS + EXP_BIAS;
        return F80 {
            mantissa,
            sign_exponent: sign | (biased as u16 & EXP_MASK),
        };
    }

    // Subnormal double input
    let mut mantissa = frac << 1;
    if mantissa == 0 {
        return F80 {
            mantissa: 0,
            sign_exponent: sign,
        };
    }
    let leading = mantissa.leading_zeros();
    let msb_index = 63 - leading;
    let shift = 63 - msb_index;
    mantissa <<= shift;
    let exponent = -DOUBLE_EXP_BIAS - DOUBLE_MANTISSA_BITS as i32;
    let biased = exponent + msb_index as i32 + EXP_BIAS;

    F80 {
        mantissa,
        sign_exponent: sign | (biased as u16 & EXP_MASK),
    }
}

fn decode_to_f64(value: &F80) -> f64 {
    let exp_field = (value.sign_exponent & EXP_MASK) as i32;
    let sign = if value.sign() { -1.0 } else { 1.0 };
    if exp_field == 0 {
        if value.mantissa == 0 {
            return if value.sign() { -0.0 } else { 0.0 };
        }
        let fraction = (value.mantissa as f64) * MANTISSA_INV;
        return sign * fraction * pow2(1 - EXP_BIAS);
    }
    if exp_field == EXP_MASK as i32 {
        if value.mantissa == IMPLIED_BIT {
            return if value.sign() { f64::NEG_INFINITY } else { f64::INFINITY };
        }
        return f64::NAN;
    }
    let fraction = (value.mantissa as f64) * MANTISSA_INV;
    sign * fraction * pow2(exp_field - EXP_BIAS)
}

fn round_ties_to_even(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    let rounded = value.round();
    let diff = (value - rounded).abs();
    if diff == 0.5 {
        let half = rounded * 0.5;
        if half.fract() == 0.0 {
            rounded
        } else {
            rounded - value.signum()
        }
    } else {
        rounded
    }
}

fn round_with_mode(value: f64, mode: u8) -> f64 {
    match mode {
        0 => round_ties_to_even(value),
        1 => value.trunc(),
        2 => value.floor(),
        3 => value.ceil(),
        _ => round_ties_to_even(value),
    }
}

fn classify_binary_flags(lhs: f64, rhs: f64, result: f64, check_div_zero: bool) -> u8 {
    let mut flags = 0;
    if check_div_zero && rhs == 0.0 && lhs != 0.0 && lhs.is_finite() {
        flags |= FLAG_DIV_ZERO;
    }
    if result.is_nan() && !lhs.is_nan() && !rhs.is_nan() {
        flags |= FLAG_INVALID_OP;
    } else if result.is_infinite() && lhs.is_finite() && rhs.is_finite() {
        flags |= FLAG_OVERFLOW;
    } else if result == 0.0 && lhs != 0.0 && rhs != 0.0 {
        if lhs.abs() < f64::MIN_POSITIVE || rhs.abs() < f64::MIN_POSITIVE {
            flags |= FLAG_UNDERFLOW;
        }
    }
    flags
}

fn to_i32_internal(value: f64, mode: u8) -> i32 {
    if !value.is_finite() {
        raise_flags(FLAG_INVALID_OP);
        return 0;
    }
    let rounded = round_with_mode(value, mode);
    if rounded != value {
        raise_flags(FLAG_PRECISION);
    }
    if rounded < i32::MIN as f64 {
        raise_flags(FLAG_INVALID_OP | FLAG_OVERFLOW);
        i32::MIN
    } else if rounded > i32::MAX as f64 {
        raise_flags(FLAG_INVALID_OP | FLAG_OVERFLOW);
        i32::MAX
    } else {
        rounded as i32
    }
}

fn to_i64_internal(value: f64, mode: u8) -> i64 {
    if !value.is_finite() {
        raise_flags(FLAG_INVALID_OP);
        return 0;
    }
    let rounded = round_with_mode(value, mode);
    if rounded != value {
        raise_flags(FLAG_PRECISION);
    }
    if rounded < i64::MIN as f64 {
        raise_flags(FLAG_INVALID_OP | FLAG_OVERFLOW);
        i64::MIN
    } else if rounded > i64::MAX as f64 {
        raise_flags(FLAG_INVALID_OP | FLAG_OVERFLOW);
        i64::MAX
    } else {
        rounded as i64
    }
}

pub enum RoundingMode {
    NearEven,
    Trunc,
    Floor,
    Ceil,
}
pub enum Precision {
    P80,
    P64,
    P32,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct F80 {
    pub mantissa: u64,
    pub sign_exponent: u16,
}
impl F80 {
    pub const ZERO: F80 = F80 {
        mantissa: 0,
        sign_exponent: 0,
    };
    pub const ONE: F80 = F80 {
        mantissa: 0x8000000000000000,
        sign_exponent: 0x3FFF,
    };
    pub const LN_10: F80 = F80 {
        mantissa: 0x935D8DDDAAA8B000,
        sign_exponent: 0x4000,
    };
    pub const LN_2: F80 = F80 {
        mantissa: 0xB17217F7D1CF7800,
        sign_exponent: 0x3FFE,
    };
    pub const PI: F80 = F80 {
        mantissa: 0xC90FDAA22168C000,
        sign_exponent: 0x4000,
    };
    pub const LOG2_E: F80 = F80 {
        mantissa: 0xB8AA3B295C17F000,
        sign_exponent: 0x3FFF,
    };
    pub const INDEFINITE_NAN: F80 = F80 {
        mantissa: 0xC000000000000000,
        sign_exponent: 0x7FFF,
    };
    pub const POS_INFINITY: F80 = F80 {
        mantissa: 0x8000000000000000,
        sign_exponent: 0x7FFF,
    };
    pub const NEG_INFINITY: F80 = F80 {
        mantissa: 0x8000000000000000,
        sign_exponent: 0xFFFF,
    };

    pub fn sign(&self) -> bool {
        (self.sign_exponent >> 15) == 1
    }
    pub fn exponent(&self) -> i16 {
        (self.sign_exponent as i16 & 0x7FFF) - 0x3FFF
    }

    pub fn of_i32(src: i32) -> F80 {
        F80::of_f64x(src as f64)
    }
    pub fn of_i64(src: i64) -> F80 {
        F80::of_f64x(src as f64)
    }

    pub fn of_f32(src: i32) -> F80 {
        F80::of_f64x(f32::from_bits(src as u32) as f64)
    }

    pub fn of_f64(src: u64) -> F80 {
        F80::of_f64x(f64::from_bits(src))
    }
    fn of_f64x(src: f64) -> F80 {
        encode_from_f64(src)
    }

    fn to_f32_components(&self) -> (i32, u8) {
        let value = self.to_f64x();
        let result = value as f32;
        let mut flags = 0;
        if value.is_finite() {
            if !result.is_finite() {
                flags |= FLAG_OVERFLOW;
            } else if result == 0.0 && value != 0.0 {
                flags |= FLAG_UNDERFLOW;
            }
        } else if value.is_nan() {
            flags |= FLAG_INVALID_OP;
        }
        (result.to_bits() as i32, flags)
    }

    pub fn to_f32(&self) -> i32 {
        let (bits, flags) = self.to_f32_components();
        raise_flags(flags);
        bits
    }

    pub fn to_f32_with_flags(&self) -> (i32, u8) {
        self.to_f32_components()
    }
    pub fn to_f64(&self) -> u64 {
        self.to_f64x().to_bits()
    }
    fn to_f64x(&self) -> f64 {
        decode_to_f64(self)
    }

    pub fn to_i32(&self) -> i32 {
        to_i32_internal(self.to_f64x(), current_rounding_mode())
    }
    pub fn to_i64(&self) -> i64 {
        to_i64_internal(self.to_f64x(), current_rounding_mode())
    }

    pub fn truncate_to_i32(&self) -> i32 {
        to_i32_internal(self.to_f64x(), 1)
    }
    pub fn truncate_to_i64(&self) -> i64 {
        to_i64_internal(self.to_f64x(), 1)
    }

    pub fn cos(self) -> F80 {
        F80::of_f64x(self.to_f64x().cos())
    }
    pub fn sin(self) -> F80 {
        F80::of_f64x(self.to_f64x().sin())
    }
    pub fn tan(self) -> F80 {
        F80::of_f64x(self.to_f64x().tan())
    }
    pub fn atan(self) -> F80 {
        F80::of_f64x(self.to_f64x().atan())
    }
    pub fn atan2(self, other: F80) -> F80 {
        F80::of_f64x(self.to_f64x().atan2(other.to_f64x()))
    }

    pub fn log2(self) -> F80 {
        let input = self.to_f64x();
        if input == 0.0 {
            raise_flags(FLAG_DIV_ZERO);
            return F80::NEG_INFINITY;
        }
        if input < 0.0 {
            raise_flags(FLAG_INVALID_OP);
            return F80::INDEFINITE_NAN;
        }
        F80::of_f64x(input.log2())
    }
    pub fn ln(self) -> F80 {
        let input = self.to_f64x();
        if input == 0.0 {
            raise_flags(FLAG_DIV_ZERO);
            return F80::NEG_INFINITY;
        }
        if input < 0.0 {
            raise_flags(FLAG_INVALID_OP);
            return F80::INDEFINITE_NAN;
        }
        F80::of_f64x(input.ln())
    }

    pub fn abs(self) -> F80 {
        F80 {
            mantissa: self.mantissa,
            sign_exponent: self.sign_exponent & !0x8000,
        }
    }
    pub fn two_pow(self) -> F80 {
        F80::of_f64x(2.0f64.powf(self.to_f64x()))
    }
    pub fn round(self) -> F80 {
        let original = self.to_f64x();
        let rounded = round_with_mode(original, current_rounding_mode());
        if original.is_finite() && rounded != original {
            raise_flags(FLAG_PRECISION);
        }
        F80::of_f64x(rounded)
    }
    pub fn trunc(self) -> F80 {
        let original = self.to_f64x();
        let truncated = original.trunc();
        if original.is_finite() && truncated != original {
            raise_flags(FLAG_PRECISION);
        }
        F80::of_f64x(truncated)
    }

    pub fn sqrt(self) -> F80 {
        let input = self.to_f64x();
        if input < 0.0 {
            raise_flags(FLAG_INVALID_OP);
            F80::INDEFINITE_NAN
        } else {
            F80::of_f64x(input.sqrt())
        }
    }

    fn binary_op_with_flags<F>(self, other: Self, check_div_zero: bool, op: F) -> (F80, u8)
    where
        F: FnOnce(f64, f64) -> f64,
    {
        let lhs = self.to_f64x();
        let rhs = other.to_f64x();
        let result = op(lhs, rhs);
        let flags = classify_binary_flags(lhs, rhs, result, check_div_zero);
        (F80::of_f64x(result), flags)
    }

    pub fn add_with_flags(self, other: Self) -> (F80, u8) {
        self.binary_op_with_flags(other, false, |lhs, rhs| lhs + rhs)
    }

    pub fn sub_with_flags(self, other: Self) -> (F80, u8) {
        self.binary_op_with_flags(other, false, |lhs, rhs| lhs - rhs)
    }

    pub fn mul_with_flags(self, other: Self) -> (F80, u8) {
        self.binary_op_with_flags(other, false, |lhs, rhs| lhs * rhs)
    }

    pub fn div_with_flags(self, other: Self) -> (F80, u8) {
        self.binary_op_with_flags(other, true, |lhs, rhs| lhs / rhs)
    }

    pub fn is_finite(self) -> bool {
        (self.sign_exponent & EXP_MASK) != EXP_MASK
    }
    pub fn is_nan(self) -> bool {
        (self.sign_exponent & EXP_MASK) == EXP_MASK && self.mantissa != IMPLIED_BIT
    }

    pub fn set_rounding_mode(mode: RoundingMode) {
        let mode_value = match mode {
            RoundingMode::NearEven => 0,
            RoundingMode::Trunc => 1,
            RoundingMode::Floor => 2,
            RoundingMode::Ceil => 3,
        };
        ROUNDING_MODE.with(|rm| rm.set(mode_value));
    }
    pub fn set_precision(precision: Precision) {
        let precision_bits = match precision {
            Precision::P80 => 80,
            Precision::P64 => 64,
            Precision::P32 => 32,
        };
        PRECISION_MODE.with(|pm| pm.set(precision_bits));
    }

    pub fn get_exception_flags() -> u8 {
        EXCEPTION_FLAGS.with(|flags| flags.get())
    }
    pub fn clear_exception_flags() {
        clear_flags()
    }

    pub fn partial_cmp_quiet(&self, other: &Self) -> Option<Ordering> {
        self.to_f64x().partial_cmp(&other.to_f64x())
    }
}

impl std::ops::Add for F80 {
    type Output = F80;
    fn add(self, other: Self) -> Self {
        let (result, flags) = self.add_with_flags(other);
        raise_flags(flags);
        result
    }
}
impl std::ops::Sub for F80 {
    type Output = F80;
    fn sub(self, other: Self) -> Self {
        let (result, flags) = self.sub_with_flags(other);
        raise_flags(flags);
        result
    }
}
impl std::ops::Neg for F80 {
    type Output = F80;
    fn neg(self) -> Self {
        let mut result = self;
        result.sign_exponent ^= 1 << 15;
        result
    }
}
impl std::ops::Mul for F80 {
    type Output = F80;
    fn mul(self, other: Self) -> Self {
        let (result, flags) = self.mul_with_flags(other);
        raise_flags(flags);
        result
    }
}
impl std::ops::Div for F80 {
    type Output = F80;
    fn div(self, other: Self) -> Self {
        let (result, flags) = self.div_with_flags(other);
        raise_flags(flags);
        result
    }
}
impl std::ops::Rem for F80 {
    type Output = F80;
    fn rem(self, other: Self) -> Self {
        if other.to_f64x() == 0.0 {
            raise_flags(FLAG_INVALID_OP);
            return F80::INDEFINITE_NAN;
        }
        let quot = (self / other).trunc();
        self - quot * other
        // Uses round-to-nearest instead of truncation
        //let mut result = F80::ZERO;
        //unsafe {
        //    extF80M_rem(&self, &other, &mut result)
        //};
        //result
    }
}

impl PartialEq for F80 {
    fn eq(&self, other: &Self) -> bool {
        if self.is_nan() || other.is_nan() {
            return false;
        }
        if self.mantissa == 0
            && (self.sign_exponent & EXP_MASK) == 0
            && other.mantissa == 0
            && (other.sign_exponent & EXP_MASK) == 0
        {
            return true;
        }
        self.to_f64x() == other.to_f64x()
    }
}
impl PartialOrd for F80 {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.to_f64x().partial_cmp(&other.to_f64x())
    }
}
