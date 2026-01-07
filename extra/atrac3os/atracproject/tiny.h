#ifndef TINY_H
#define TINY_H

#include <stddef.h>
#include <stdbool.h>

typedef struct tiny_operation {
    enum tiny_function {
        TINY_LOAD,
        TINY_INIT,
        TINY_CLEAR,
        TINY_RESET,
        TINY_MALLOC,
        TINY_REALLOC,
        TINY_CALLOC,
        TINY_FREE
    } function;
    bool success;
    size_t size;
} tiny_operation;

typedef struct tiny_size {
    size_t blocks;
    size_t bytes;
} tiny_size;

typedef struct tiny_summary {
    size_t alignment;
    char *aligned_type;
    void *static_buffer;
    size_t static_buffer_size;
    bool out_of_memory;
    void *buffer;
    tiny_size total;
    tiny_size free;
    tiny_size taken;
    struct tiny_sections {
        size_t total;
        size_t free;
        size_t taken;
    } sections;
} tiny_summary;

typedef struct tiny_section {
    bool taken;
    void *header;
    void *data;
    tiny_size size;
} tiny_section;

void tiny_init(unsigned char *buffer, size_t size);
void tiny_clear(void);
void tiny_reset(void);
void tiny_out_of_memory(bool status);
tiny_operation tiny_last_operation(void);
size_t tiny_block_size(void);
void tiny_print(bool summary, bool last_op, bool heap);
tiny_summary tiny_inspect(void);
tiny_section tiny_next_section(void *previous_header);
void *tiny_malloc(size_t size);
void *tiny_realloc(void *ptr, size_t size);
void *tiny_calloc(size_t num, size_t size);
void tiny_free(void *ptr);

#endif /* end of guard: TINY_H */