import { MinidiscSpec, NetMDFactoryService, NetMDService } from './interfaces/netmd';
import { AudioExportService } from './audio/audio-export';
import { MediaRecorderService } from './browserintegration/mediarecorder';
import { MediaSessionService } from './browserintegration/media-session';
import { LibraryService } from './library/library';

interface ServiceRegistry {
    netmdService?: NetMDService;
    netmdSpec?: MinidiscSpec;
    netmdFactoryService?: NetMDFactoryService;
    audioExportService?: AudioExportService;
    mediaRecorderService?: MediaRecorderService;
    mediaSessionService?: MediaSessionService;
    libraryService?: LibraryService;
}

const ServiceRegistry: ServiceRegistry = {};

export default ServiceRegistry;
