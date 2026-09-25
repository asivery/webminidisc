import { MinidiscSpec, NetMDFactoryService, NetMDService } from './interfaces/netmd';
import { MediaRecorderService } from './browserintegration/mediarecorder';
import { MediaSessionService } from './browserintegration/media-session';
import { LibraryService } from './library/library';
import { AudioEncoderV1Instance } from './audio/apiv1/external-interface';

interface ServiceRegistry {
    netmdService?: NetMDService;
    netmdSpec?: MinidiscSpec;
    netmdFactoryService?: NetMDFactoryService;
    audioExportService?: AudioEncoderV1Instance;
    mediaRecorderService?: MediaRecorderService;
    mediaSessionService?: MediaSessionService;
    libraryService?: LibraryService;
}

const ServiceRegistry: ServiceRegistry = {};

export default ServiceRegistry;
