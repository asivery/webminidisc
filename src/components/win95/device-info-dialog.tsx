import React from 'react';
import { Button, WindowHeader } from 'react95';
import { FooterButton, DialogOverlay, DialogWindow, DialogFooter, DialogWindowContent, WindowCloseIcon } from './common';
import type { DeviceInfoRow } from '../device-info-rows';

export const W95DeviceInfoDialog = (props: {
    visible: boolean;
    handleClose: () => void;
    title: string;
    imageUrl: string;
    rows: DeviceInfoRow[];
}) => {
    if (!props.visible) {
        return null;
    }

    return (
        <DialogOverlay>
            <DialogWindow>
                <WindowHeader style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: '1 1 auto' }}>{props.title}</span>
                    <Button onClick={props.handleClose}>
                        <WindowCloseIcon />
                    </Button>
                </WindowHeader>
                <DialogWindowContent>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <img src={props.imageUrl} alt={props.title} style={{ width: 140, maxWidth: '100%' }} />
                        <table>
                            <tbody>
                                {props.rows.map((row) => (
                                    <tr key={row.label}>
                                        <td style={{ fontWeight: 'bold', paddingRight: 12, verticalAlign: 'top' }}>{row.label}</td>
                                        <td>{row.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <DialogFooter>
                        <FooterButton onClick={props.handleClose}>OK</FooterButton>
                    </DialogFooter>
                </DialogWindowContent>
            </DialogWindow>
        </DialogOverlay>
    );
};
