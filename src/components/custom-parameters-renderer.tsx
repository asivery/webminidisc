import React, { useEffect, useState } from 'react';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import { CustomParameterInfo, CustomParameters, CustomParameterType, getDefaultForType } from '../custom-parameters';
import { Button, MenuItem, Select, Tooltip } from '@mui/material';

export function CustomParameterRendered({ parameter, values, parameterChangeCallback, customClass}: 
    {
        parameter: CustomParameterInfo,
        values: CustomParameters,
        parameterChangeCallback: (varName: string, newValue: any) => void,
        customClass?: string
    }
) {
    const value = values[parameter.varName] as any;
    const [type, setType] = useState<CustomParameterType>(null);
    useEffect(() => {
        const newType = typeof parameter.type === 'function' ? parameter.type(values) : parameter.type;
        if(Array.isArray(newType) && Array.isArray(type)) {
            if(newType.length !== type.length || !newType.every((e, i) => e.value === type[i].value)) {
                setType(newType);
                if(!newType.find(e => e.value === values[parameter.varName]!)) 
                    parameterChangeCallback(parameter.varName, getDefaultForType(newType));
            }
        } else {
            if(newType !== type) {
                setType(newType);
                if(type !== null)
                    parameterChangeCallback(parameter.varName, getDefaultForType(newType));
            }
        }
    }, [values, type, parameter]);
    const handleParameterChange = (event: any, type: CustomParameterType, name: string) => {
        parameterChangeCallback(
            name,
            type === 'string' || Array.isArray(type)
                ? event.target.value
                : type === 'number'
                  ? parseInt(event.target.value)
                  : event.target.checked
        );
    };

    const fullWidth = { minWidth: '100%' };

    if(!type) return null;

    if (Array.isArray(type)) {
        // Enumerator:
        return (
            <FormControlLabel
                className={customClass}
                control={
                    <Select
                        value={value}
                        onChange={(e) => handleParameterChange(e, type, parameter.varName)}
                        className={customClass}
                    >
                        {type.map((e) => (
                            <MenuItem value={e.value} key={e.value}>
                                {e.name}
                            </MenuItem>
                        ))}
                    </Select>
                }
                label={parameter.userFriendlyName}
                labelPlacement="start"
                style={{ ...fullWidth, justifyContent: 'space-between', marginLeft: 0, marginBottom: 8 }}
                key={parameter.varName}
            />
        );
    }

    switch (type) {
        case 'boolean':
            return (
                <FormControlLabel
                    className={customClass}
                    control={<Checkbox checked={value} onChange={(e) => handleParameterChange(e, type, parameter.varName)} />}
                    label={parameter.userFriendlyName}
                    style={fullWidth}
                    key={parameter.varName}
                />
            );
        case 'string':
            return (
                <TextField
                    className={customClass}
                    key={parameter.varName}
                    label={parameter.userFriendlyName}
                    error={parameter.validator ? !parameter.validator(value) : false}
                    value={value || ''}
                    onChange={(e) => handleParameterChange(e, type, parameter.varName)}
                    style={fullWidth}
                />
            );
        case 'number':
            return (
                <TextField
                    className={customClass}
                    label={parameter.userFriendlyName}
                    error={parameter.validator ? !parameter.validator(value) : false}
                    type="number"
                    value={value || 0}
                    onChange={(e) => handleParameterChange(e, type, parameter.varName)}
                    style={fullWidth}
                    key={parameter.varName}
                />
            );
        case 'hostDirPath':
        case 'hostFilePath':
            return (
                <FormControlLabel
                    classes={{ root: customClass }}
                    control={
                        <Tooltip title={value || '<NONE>'}>
                            <Button
                                style={{ color: !(parameter.validator?.(value) ?? true) ? 'red' : undefined }}
                                onClick={() => {
                                    window.native
                                        ?.openFileHostDialog?.([{ name: 'All files', extensions: ['*'] }], type === 'hostDirPath')
                                        ?.then((e) => {
                                            parameterChangeCallback(parameter.varName, e ?? '');
                                        });
                                }}
                            >
                                Choose {type === 'hostDirPath' ? 'Directory' : 'File'}
                            </Button>
                        </Tooltip>
                    }
                    label={parameter.userFriendlyName}
                    labelPlacement="start"
                    style={{ ...fullWidth, justifyContent: 'space-between' }}
                    key={parameter.varName}
                />
            );
        default:
            throw new Error('Cannot render property - is your setup correct?');
    }
}
