import * as React from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Grow from '@mui/material/Grow';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import { ButtonProps } from '@mui/material/Button';
import { CircularProgress } from '@mui/material';

export type OptionType = {
    name: string;
    handler: () => void;
    switchTo: boolean;
    disabled?: boolean;
} & any;

export type SplitButtonProps = {
    options: OptionType[];
    boxClassName?: string;
    width?: number;
    selectedIndex?: number;
    dropdownMapping?: (option: OptionType) => any;
    loading?: boolean;
} & ButtonProps;

export default function SplitButton(props: SplitButtonProps) {
    const [open, setOpen] = React.useState(false);
    const anchorRef = React.useRef<HTMLDivElement>(null);

    const { options, boxClassName, width, selectedIndex: initialSelected, dropdownMapping, loading, ...buttonProps } = props;

    const [selectedIndex, setSelectedIndex] = React.useState(initialSelected || 0);

    const handleMenuItemClick = (event: React.MouseEvent<HTMLLIElement, MouseEvent>, index: number) => {
        if (options[index].switchTo) {
            setSelectedIndex(index);
        }
        options[index].handler();
        setOpen(false);
    };

    const handleToggle = () => {
        setOpen((prevOpen) => !prevOpen);
    };

    const handleClose = (event: any) => {
        if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
            return;
        }

        setOpen(false);
    };

    return (
        <div className={boxClassName}>
            <ButtonGroup variant="contained" ref={anchorRef} aria-label="split button" disabled={loading}>
                <Button {...buttonProps} onClick={options[selectedIndex].handler} style={{ minWidth: width ? width * 0.8 : undefined }}>
                    {loading ? <CircularProgress style={{ width: 24, height: 24 }} /> : options[selectedIndex].name}
                </Button>
                <Button
                    size="small"
                    aria-controls={open ? 'split-button-menu' : undefined}
                    aria-expanded={open ? 'true' : undefined}
                    aria-label="select merge strategy"
                    aria-haspopup="menu"
                    onClick={handleToggle}
                    style={{ minWidth: width ? width * 0.2 : undefined, background: '#e0e0e0' }}
                >
                    <ArrowDropDownIcon htmlColor="#000" />
                </Button>
            </ButtonGroup>
            <Popper
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                style={{ zIndex: 1000, minWidth: width }}
                transition
                disablePortal
            >
                {({ TransitionProps, placement }) => (
                    <Grow
                        {...TransitionProps}
                        style={{
                            transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
                        }}
                    >
                        <Paper>
                            <ClickAwayListener onClickAway={handleClose}>
                                <MenuList id="split-button-menu" style={{ width: '100%' }}>
                                    {options.map((option, index) => (
                                        <MenuItem
                                            key={`${index}-connect-button`}
                                            disabled={option.disabled || loading}
                                            selected={index === selectedIndex}
                                            onClick={(event) => handleMenuItemClick(event, index)}
                                        >
                                            {dropdownMapping ? dropdownMapping(option) : option.name}
                                        </MenuItem>
                                    ))}
                                </MenuList>
                            </ClickAwayListener>
                        </Paper>
                    </Grow>
                )}
            </Popper>
        </div>
    );
}
