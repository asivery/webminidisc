#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

#include "lib.h"

int main(int argc, const char **argv) {
    if(argc != 4) {
        printf("Usage: %s <in.pcm> <out.at3stream> <bitrate>\n", *argv);
        return -1;
    }
    FILE *in = fopen(argv[1], "r");
    FILE *out = fopen(argv[2], "w");
    int bitrate = atoi(argv[3]);

    fseek(in, 0, SEEK_END);
    size_t len = ftell(in);
    fseek(in, 0, SEEK_SET);

    uint8_t *in_buffer = malloc(len);
    if(fread(in_buffer, len, 1, in) != 1){
        printf("Unable to read all of the input PCM file!\n");
        return -2;
    }


    if(initialize(bitrate) != 1) {
        printf("Failed to initialize encoder!\n");
        return -3;
    }
    size_t atrac_len = calculate_atrac_buf_size(len);
    uint8_t *atrac_buffer = malloc(atrac_len);

    size_t encoded_bytes = encode(in_buffer, atrac_buffer, len, atrac_len);
    if(encoded_bytes == -1) {
        printf("Failed to encode ATRAC!\n");
        return -4;
    }

    encoded_bytes = finish(atrac_buffer, encoded_bytes);

    if(fwrite(atrac_buffer, encoded_bytes, 1, out) != 1) {
        printf("Cannot write output file!\n");
        return -5;
    }

    free(in_buffer);
    free(atrac_buffer);
    fclose(in);
    fclose(out);
}
