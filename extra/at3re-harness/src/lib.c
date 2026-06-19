#include <atrac/atrac_api.h>

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include "configs.h"
#include "lib.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define LOG_PROGRESS(progress) EM_ASM({                                 \
                                   self.postMessage({ progress: $0 });  \
                               }, pcm_cursor)
#else
#define LOG_PROGRESS(progress) printf("Encoding progress: %ld\n", progress)
#endif


const atrac_encoding_configuration *def = NULL;
atrac_handle handle;
void *atrac_buffer;

int initialize(int bitrate) {
    def = definition_from_bitrate(bitrate);
    if(def == NULL) {
        printf("Invalid bitrate provided!\n");
        return 0;
    }

    handle = atrac_get_handle();
    if(atrac_set_codec_info(handle, def->codec_info) != 0){
        printf("atrac_set_codec_info\n");
        return 0;
    }
    if(atrac_set_encode_algorithm(handle, def->encode_algorithm) != 0){
        printf("atrac_set_encode_algorithm\n");
        return 0;
    }
    if(atrac_init_encode(handle) != 0){
        printf("atrac_init_encode\n");
        return 0;
    }

    uint32_t unknown, pcm_buffer_size, atrac_buffer_size, block_size;
    if(atrac_get_buffer_request(handle, &unknown, &pcm_buffer_size, &block_size, &atrac_buffer_size) != 0) {
        printf("atrac_get_buffer_request\n");
        return -1;
    }
    atrac_buffer = malloc(atrac_buffer_size);
    return 1;
}

size_t calculate_atrac_buf_size(size_t pcm_len) {
    size_t frame_length = def->samples_per_channel_per_frame * SAMPLE_SIZE * def->channel_count;
    size_t frames = pcm_len / frame_length;
    return (frames + 10 /* leeway for flushing the final frames */) * def->frame_size;
}

size_t encode(
    uint8_t *pcm,
    uint8_t *atrac_out,
    size_t pcm_len,
    size_t atrac_len
) {
    // atrac_len is the initial size of the buffer. It might get grown through `realloc`, if the heuristics
    // estimating its original size fail.

    size_t pcm_cursor = 0, atrac_cursor = 0;
    int frame_counter = 0, res;
    uint32_t written_bytes;
    int frame_length = def->samples_per_channel_per_frame * SAMPLE_SIZE * def->channel_count;

    // atrac_len MUST be a multiple of def->frame_size.

    size_t one_percent_frames = (pcm_len / frame_length) / 100;

    while(pcm_cursor < pcm_len) {
        if((frame_counter++ % one_percent_frames) == 0) {
            LOG_PROGRESS(pcm_cursor);
        }

        if((res = atrac_encode(
            handle,
            &pcm[pcm_cursor],
            atrac_buffer,
            frame_length,
            &written_bytes
        )) < 0) {
            printf("atrac_encode\n");
            return -1;
        }
        pcm_cursor += frame_length;
        if(written_bytes) {
            if((atrac_len - atrac_cursor) < def->frame_size) {
                printf("Error! We've ran out of buffer!\n");
                return -1;
            }
            memcpy(&atrac_out[atrac_cursor], atrac_buffer, def->frame_size);
            atrac_cursor += def->frame_size;
        }
    }

    return atrac_cursor;
}

int finish(uint8_t *atrac_out, size_t atrac_cursor) {
    // Enough additional frames should be allocated so that this never overflows the buffer.
    int x;
    uint32_t written_bytes;

    atrac_flush_encode(handle, atrac_buffer, &written_bytes, &x);
    memcpy(&atrac_out[atrac_cursor], atrac_buffer, written_bytes);
    atrac_cursor += written_bytes;

    atrac_free_encode(handle);
    atrac_free_handle(&handle);
    free(atrac_buffer);

    def = NULL;

    return atrac_cursor;
}
