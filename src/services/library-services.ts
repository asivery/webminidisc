import { CustomParameterInfo, CustomParameters } from "../custom-parameters";
import { LibraryService } from "./library/library";
import { RemoteLibraryService } from "./library/remote-library";


interface LibraryServicePrototype<T extends LibraryService> {
    create: new (parameters: CustomParameters) => T;
    customParameters?: CustomParameterInfo[];
    name: string;
    description?: string;
}

export const LibraryServices: LibraryServicePrototype<LibraryService>[] = [
    {
        name: 'Remote Library',
        create: RemoteLibraryService,
        customParameters: [
            {
                userFriendlyName: 'Server Address',
                varName: 'address',
                type: 'string',
                defaultValue: 'http://localhost:8000/',
                validator: content => {
                    try {
                        new URL(content);
                        return true;
                    } catch (e) {
                        return false;
                    }
                },
            },
        ],
        description:
            'A remote library with an inbuilt encoder. Lets you cut down on bandwidth usage, by having the files sent to the local Web Minidisc instance preencoded.',
    },

]
