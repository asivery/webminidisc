#pragma once

typedef void *atrac_handle;
typedef int atrac_codec_info;

atrac_handle atrac_get_handle();
int atrac_set_codec_info(atrac_handle handle, atrac_codec_info info);
int atrac_set_encode_algorithm(atrac_handle handle, atrac_codec_info info);
int atrac_init_encode(atrac_handle handle);
int atrac_get_buffer_request(atrac_handle handle, int *unknown, int *inputBufferSize, int *blockSize, int *outputBufferSize);
int atrac_encode(atrac_handle handle, void *pcmBuffer, void *outBuffer, int bytesLength, int *writtenBytes);
int atrac_flush_encode(atrac_handle handle, void *outBuffer, int *writtenSamples, int *remainingToWrite);
void atrac_free_encode(atrac_handle handle);
void atrac_free_handle(atrac_handle *handle);
