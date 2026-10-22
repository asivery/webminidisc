import React from 'react';
import { EncoderStorageManager } from '../services/audio/apiv1/dynamic-encoders';

export class SettingsResetErrorBoundary extends React.Component<
    {
        children: React.ReactNode;
    },
    {
        wipeSettings: boolean;
    }
> {
    constructor(props: any) {
        super(props);
        this.state = { wipeSettings: true };
    }

    componentDidMount(): void {
        window.setTimeout(() => this.setState({ wipeSettings: false }), 15000);
    }

    render(): React.ReactNode {
        return <>{this.props.children}</>;
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('Root rendering error!!');
        console.error(error);
        console.error(errorInfo);
        const errorString = `${(error.stack ?? error.message).substring(0, 200)}...`;
        if (this.state.wipeSettings) {
            window.alert(
                `Unrecoverable error while initializing app. Your app settings have been deleted.\n${errorString}\nPress OK to restart.\nIf this keeps happening, close and reopen your browser.`
            );
            window.localStorage.clear();
            if('serviceWorker' in window) {
                if(window.navigator && navigator.serviceWorker) {
                    navigator.serviceWorker.getRegistrations()
                        .then(function(registrations) {
                            for(let registration of registrations) {
                                registration.unregister();
                            }
                        });
                }
            }
            if(EncoderStorageManager.INSTANCE) {
                EncoderStorageManager.INSTANCE.reset().then(() => window.reload());
            }
            return;
        } else {
            window.alert(`Unrecoverable error.\n${errorString}\nPress OK to restart.`);
        }
        window.reload();
    }
}
