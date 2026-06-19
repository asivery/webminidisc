#pragma once
#include <stdint.h>

int initialize(int bitrate);
size_t calculate_atrac_buf_size(size_t pcm_len);
size_t encode(
    uint8_t *pcm,
    uint8_t *atrac_out,
    size_t pcm_len,
    size_t atrac_len
);
int finish(uint8_t *atrac_out, size_t atrac_cursor);
