export type CustomParameters = { [key: string]: string | number | boolean };
export type CustomParameterType = 'string' | 'number' | 'boolean' | 'hostFilePath' | 'hostDirPath' | { name: string, value: string }[];
export type CustomParameterInfo = {
    userFriendlyName: string;
    varName: string;
    type: CustomParameterType;
    defaultValue?: string | number | boolean;
    validator?: (content: string) => boolean;
};

export function isAllValid(archetype?: CustomParameterInfo[], parameters?: CustomParameters) {
    if (!archetype || !parameters) return true;
    for (const parameter of archetype) {
        if (parameter.validator) {
            if (!parameter.validator(parameters[parameter.varName]?.toString())) {
                return false;
            }
        }
    }
    return true;
}

function getDefaultForType(type: CustomParameterType) {
    if(Array.isArray(type)) return '';
    switch (type) {
        case 'boolean':
            return false;
        case 'string':
            return '';
        case 'number':
            return 0;
        case 'hostFilePath':
            return '';
        case 'hostDirPath':
            return '';
    }
}

export function initializeParameters(archetype?: CustomParameterInfo[]) {
    const emptyParameters: CustomParameters = {};
    for (const param of archetype ?? []) {
        emptyParameters[param.varName] = param.defaultValue || getDefaultForType(param.type);
    }
    return emptyParameters;
}
