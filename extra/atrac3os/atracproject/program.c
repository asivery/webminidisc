#include <stdint.h>
#include "atrac.h"
#include "configs.c"
#include "tiny.h"
static inline void print(const char *data) {
    __asm__ volatile(
        "mov %0, %%eax\n"
        "out %%al, $0xff\n" :: "m"(data) : "eax"
    );
}
static inline void print_number(unsigned long long int data) {
    unsigned int hi = (data >> 32) & 0xFFFFFFFFULL;
    unsigned int lo = data & 0xFFFFFFFFULL;
    __asm__ volatile(
        "mov %0, %%eax\n"
        "mov %1, %%ebx\n"
        "out %%al, $0xfe\n" :: "r"(hi), "r"(lo) : "eax", "ebx"
    );
}
static inline void hypervisor_transfer(void *a, int a_offset, void *b, int b_offset, int length) {
    __asm__ volatile(
        "mov %0, %%eax\n"
        "mov %1, %%ebx\n"
        "mov %2, %%ecx\n"
        "out %%al, $0xfc\n" :: "r"(a), "r"(b), "r"(length) : "eax", "ebx", "ecx"
    );
}
#define malloc tiny_malloc
#define free tiny_free

#include "stdlib-func.c"


const atrac_encoding_configuration *definition_from_bitrate(int bitrate) {
    for(int i = 0; i<(sizeof(supported_encoding_configurations) / sizeof(supported_encoding_configurations[0])); i++) {
        const atrac_encoding_configuration *d = &supported_encoding_configurations[i];
        if(d->bitrate_kbps == bitrate && d->channel_count == 2) return d;
    }
    return NULL;
}

const atrac_encoding_configuration *def = NULL;
atrac_handle handle;
void *pcm_buffer, *atrac_buffer;

int initialize(int bitrate) {
    def = definition_from_bitrate(bitrate);
    if(def == NULL) {
        print("Invalid bitrate provided!");
        return 0;
    }

    handle = atrac_get_handle();
    if(atrac_set_codec_info(handle, def->codec_info) != 0){
        print("atrac_set_codec_info\n");
        return 0;
    }
    if(atrac_set_encode_algorithm(handle, def->encode_algorithm) != 0){
        print("atrac_set_encode_algorithm\n");
        return 0;
    }
    if(atrac_init_encode(handle) != 0){
        print("atrac_init_encode\n");
        return 0;
    }

    int unknown, pcm_buffer_size, atrac_buffer_size, block_size;
    if(atrac_get_buffer_request(handle, &unknown, &pcm_buffer_size, &block_size, &atrac_buffer_size) != 0) {
        print("atrac_get_buffer_request\n");
        return -1;
    }
    pcm_buffer = malloc(def->samples_per_channel_per_frame * SAMPLE_SIZE * def->channel_count);
    atrac_buffer = malloc(atrac_buffer_size);
    return 1;
}

int encode_atrac(
    void *in_pcm,
    void *out_atrac,
    unsigned long long int pcm_length,
    int bitrate,
    bool is_last_batch
) {
    if(def == NULL) {
        if(!initialize(bitrate)) return -1;
    }
    unsigned long long int pcm_cursor = 0;
    int atrac_cursor = 0, written_bytes = 0;
    int res;
    int i = 0;
    int frame_length = def->samples_per_channel_per_frame * SAMPLE_SIZE * def->channel_count;

    while(pcm_cursor < pcm_length) {
        // Load a batch of PCM
        if((i++ % 50) == 0) print_number(pcm_cursor);

        hypervisor_transfer(
            (void *) pcm_buffer, 0,
            in_pcm, pcm_cursor,
            frame_length
        );

        if((res = atrac_encode(
            handle,
            pcm_buffer,
            atrac_buffer,
            frame_length,
            &written_bytes
        )) < 0){
            print("atrac_encode\n");
            return -1;
        }
        pcm_cursor += def->samples_per_channel_per_frame * SAMPLE_SIZE  * def->channel_count;
        if(written_bytes != 0) {
            hypervisor_transfer(out_atrac, atrac_cursor, atrac_buffer, 0, def->frame_size);
            atrac_cursor += def->frame_size;
        }
    }
    if(is_last_batch) {
        int x;
        atrac_flush_encode(handle, atrac_buffer, &written_bytes, &x);
        hypervisor_transfer(out_atrac, atrac_cursor, atrac_buffer, 0, written_bytes);
        atrac_cursor += written_bytes;
        atrac_free_encode(handle);
        atrac_free_handle(&handle);
        free(pcm_buffer);
        free(atrac_buffer);
        print("Completed.");
        def = NULL;
    } else {
        print("Completed. (Context retained)");
    }

    return atrac_cursor;
}

int process() {
    print("Process!!");
    int *data = (int *) 0x850000;
    unsigned long long int length = data[1];
    length <<= 32;
    length |= data[0];
    encode_atrac((void *) 0x50000000, (void *) 0x60000000, length, data[2], data[3]);
}

void global_init() {
    print("Global Init!");
    tiny_init((void *) 0x850010, 1024 * 1024 * 2 - 0x10);
    def = NULL;
}
