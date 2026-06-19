#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef void *atrac_handle;
typedef enum atrac_codec_version_e {
    ATRAC_VERSION_3 = 3,
    ATRAC_VERSION_3PLUS = 5,
} atrac_codec_version;

typedef struct atrac_encoding_configuration_s {
    atrac_codec_version atrac_version;
    uint32_t bitrate_kbps;
    uint32_t channel_count;
    uint32_t samples_per_channel_per_frame;
    uint32_t sample_rate;
    uint32_t frame_size;
    uint32_t codec_info;
    uint32_t encode_algorithm;
    uint32_t needs_duplicated_samples;
} atrac_encoding_configuration;

#define SAMPLE_SIZE sizeof(uint16_t)

extern const atrac_encoding_configuration supported_encoding_configurations[19];
const atrac_encoding_configuration *definition_from_bitrate(int bitrate);
