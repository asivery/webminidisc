import React, { createContext, useContext, useRef } from 'react';
import type { AdaptiveFile } from '../utils';

type SourceFile = File | AdaptiveFile;
function createSources() {
    const files = new Map<string, SourceFile>();
    let nextId = 0;
    return {
        register(file: SourceFile) {
            const id = `upload-${++nextId}`;
            files.set(id, file);
            return id;
        },
        get: (id: string) => files.get(id),
        retain(ids: string[]) {
            const retained = new Set(ids);
            for (const id of files.keys()) if (!retained.has(id)) files.delete(id);
        },
        clear: () => files.clear(),
    };
}
const RenameSourcesContext = createContext<ReturnType<typeof createSources> | null>(null);
export function RenameSourcesProvider({ children }: { children: React.ReactNode }) {
    const sources = useRef<ReturnType<typeof createSources>>();
    if (!sources.current) sources.current = createSources();
    return <RenameSourcesContext.Provider value={sources.current}>{children}</RenameSourcesContext.Provider>;
}
// The context and provider intentionally share their lifetime and API.
// eslint-disable-next-line react-refresh/only-export-components
export function useRenameSources() {
    const sources = useContext(RenameSourcesContext);
    if (!sources) throw new Error('RenameSourcesProvider is missing');
    return sources;
}
