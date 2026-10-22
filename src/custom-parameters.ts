export type CustomParameters = { [key: string]: string | number | boolean };
export type CustomParameterType = 'string' | 'number' | 'boolean' | 'hostFilePath' | 'hostDirPath' | { name: string, value: string }[] | null;
export type CustomParameterTypeOrFunction = CustomParameterType | ((params: CustomParameters) => CustomParameterType);
export type CustomParameterInfo = {
    userFriendlyName: string;
    varName: string;
    type: CustomParameterTypeOrFunction;
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

export function getDefaultForType(type: CustomParameterType) {
    if(typeof type === 'function') return '';
    if(Array.isArray(type)) return type[0]?.value ?? '';
    if(type === null) return '';
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
        if(typeof param.type !== 'function')
            emptyParameters[param.varName] = param.defaultValue || getDefaultForType(param.type);
    }
    for (const param of archetype ?? []) {
        if(typeof param.type === 'function')
            emptyParameters[param.varName] = param.defaultValue || getDefaultForType(param.type(emptyParameters));
    }
    return emptyParameters;
}
