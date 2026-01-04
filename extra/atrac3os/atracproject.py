import sys
sys.path.append('calderalinker')

from linker import *
from kernel import *
from gdt import *

u = environment
k = kern_environment

u.result = 'atracproject'
u.outdir = 'output'
u.supress_js = True
k.output = 'output/kernel.bin'

k.control_transfer_address = u.org = 0x84_0000
entry_section()

u.org = 0x40_0000
library = linksofile('atracproject/program.so')

math = linksofile('/usr/lib32/libm.so.6')
atrac = linksofile('atracproject/libatrac.so.1')
linkallundef(atrac, math)
linkallundef(library, atrac)
linkallundef(atrac, library)
linkundef(atrac, 'malloc', library, 'tiny_malloc')
linkundef(atrac, 'calloc', library, 'tiny_calloc')
linkundef(atrac, 'free', library, 'tiny_free')


jsentry('globalInit', library, 'global_init')
jsentry('_process', library, 'process')

# Heap:
rawsection(RawData(0x850000, [0] * 1024 * 1024 * 2))
k.stack_base = 0x80_0000
rawsection(RawData(k.stack_base - 0x10000, 0x10000 * [0]))

insert_gdt_entry(15, 0x60_0000, 0x1_0000, A_PRESENT | A_DATA | A_DATA_WRITABLE | A_PRIV_3 | A_DIR_CON_BIT, F_PROT_32)
rawsection(RawData(0x60_0000, 0x1_0000 * [0]))
bind_register_to_selector('gs', 15, S_GDT | S_PRIV_3)

finish()
build_kernel()
