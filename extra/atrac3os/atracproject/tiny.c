#include "tiny.h"
#include <stdio.h>
#include <string.h>
#include <stdint.h>

// Casts a size_t to its closest aligned size
#define ALIGN_SIZE(size) ((size + ALIGNMENT - 1) & ~(ALIGNMENT - 1))

// Casts an unsigned char * to its closest aligned pointer
#define ALIGN_PTR(ptr) (unsigned char *)(((uintptr_t)ptr + ALIGNMENT - 1) & ~(ALIGNMENT - 1))

#ifdef TINY_ALIGNMENT
// Alignment is provided manually
struct tiny_max_align{ char c; TINY_ALIGNMENT align; };
#else
// Alignment is automatically calculated (requires max_align_t)
#define TINY_ALIGNMENT max_align_t
struct tiny_max_align{ char c; max_align_t align; };
#endif
enum { ALIGNMENT = offsetof(struct tiny_max_align, align) };

#define EXPAND1(X) #X
#define EXPAND2(X) EXPAND1(X)
#define ALIGNED_TYPE EXPAND2(TINY_ALIGNMENT)

// Defines how many blocks a size_t takes 
enum { HEADER_BLOCKS = ALIGN_SIZE(sizeof(size_t)) / ALIGNMENT };

// Defines the upper bit of the header as a the taken flag
#define TAKEN_BIT ((size_t)-1 ^ (((size_t)-1)>>1))

// Defines blocks as arrays with ALIGNMENT bytes
typedef unsigned char tiny_block[ALIGNMENT];

#ifdef TINY_BUFFER
// Statically declares and initialises a buffer. This allows the library to be
// used before `tiny_init()` is called.

// Defines an union padded at the end to fit alignment that can hold a size_t
union tiny_padded_size { size_t size; tiny_block padding[HEADER_BLOCKS]; };

// Defines an union that contains the buffer and is aligned to alignof(TINY_ALIGN)
static union tiny_aligned_buffer {
    // Splits the buffer into header, content and footer
    struct tiny_main_layout {
        union tiny_padded_size header;
        union tiny_padded_size content[TINY_BUFFER / ALIGNMENT / HEADER_BLOCKS - 2];
        union tiny_padded_size  footer;
    } layout;

    // Taking the address of this member allows to read the layout as an array
    union tiny_padded_size buffer; 

    // Aligns the buffer to the boundary defined by alignof(TINY_ALIGN)
    TINY_ALIGNMENT align;
} tiny_buffer = { {
    { (size_t)(TINY_BUFFER / ALIGNMENT - 2 * HEADER_BLOCKS) },
    { { 0 } },
    { (size_t)TAKEN_BIT }
} };

// Initialises the library with the statically allocated buffer
#define TINY_INITIAL {                                  \
    (tiny_block *)&tiny_buffer.buffer,                  \
    (TINY_BUFFER / ALIGNMENT - 2 * HEADER_BLOCKS),      \
    false,                                              \
    {                                                   \
        TINY_LOAD,                                      \
        true,                                           \
        (TINY_BUFFER / ALIGNMENT - 2 * HEADER_BLOCKS)   \
    }                                                   \
}
#else
// Initialised the library with no allocated buffer.
#define TINY_INITIAL { NULL, 0, false, { TINY_LOAD, true, 0 } }
#endif

// Map of operations for inspection purpose
static const char * const operations[] = {         
    "TINY_LOAD",
    "TINY_INIT",
    "TINY_CLEAR",
    "TINY_RESET",
    "TINY_MALLOC",
    "TINY_REALLOC",
    "TINY_CALLOC",
    "TINY_FREE" 
};

// Describes a section of the buffer that may or may not be taken
typedef struct tiny_block_section {
    bool taken; // Marks if this section is currently in use by the programmer
    size_t size; // Specifies how many blocks are there in this section
    tiny_block *header; // The address of the section header
    void *data; // The address of the section data
} tiny_block_section;

// The main library context
static struct tiny {
    tiny_block *buffer; // The buffer to operate on
    size_t size;    // The minimum amount of blocks available for allocation
    bool out_of_memory; // Whether should the library fake an out-of-memory situation
    tiny_operation last_operation; // Stores the last operation executed
} tiny = TINY_INITIAL;

// Writes a header size and availability
static void write_header(tiny_block *header, size_t size, bool taken) {
    *(size_t *)header = taken ? TAKEN_BIT | size : size;
}

// Parses a header and returns the parsed information
static tiny_block_section read_header(tiny_block *header) {
    size_t header_value = *(size_t *)header;
    tiny_block_section section = { 
        header_value & TAKEN_BIT,
        header_value & ~TAKEN_BIT,
        header,
        (void *)(header + HEADER_BLOCKS) 
    };
    return section;
}

// Allocates some blocks of memory in the provided section.
// If the section is bigger than necessary, it may be split and a new section
// with the remaining space may be created.
static void allocate_at(tiny_block_section section, size_t block_count) {
    size_t remaining_space = 
        section.size - block_count;

    if(remaining_space <= HEADER_BLOCKS) {
        write_header(section.header, section.size, true);
    } else {
        write_header(section.header, block_count, true);
        write_header(
            section.header + block_count + HEADER_BLOCKS, 
            remaining_space - HEADER_BLOCKS, 
            false
        );
    }
}

// Returns the address of the next section
static tiny_block *next_section(tiny_block *header) {
    tiny_block_section info = read_header(header);
    return header + info.size + HEADER_BLOCKS;
}

// Stores the last operation performed by the library into the main context
static void store_operation(enum tiny_function function, bool success, size_t size) {
    tiny_operation op = { function, success, size };
    tiny.last_operation = op;
}

// Initialises the library with a buffer.
// This will partition the buffer accordingly and allow allocating and
// deallocating memory from it.
void tiny_init(unsigned char *buffer, size_t size) {
    unsigned char *aligned = ALIGN_PTR(buffer); 
    size_t lost_alignment = aligned - buffer;

    if(lost_alignment + (2 * HEADER_BLOCKS + 1) * ALIGNMENT >= size) {
        store_operation(TINY_INIT, false, size);
        return;
    } 

    tiny.buffer = (tiny_block *)aligned;
    tiny.size = (size - lost_alignment) / ALIGNMENT - 2 * HEADER_BLOCKS;

    write_header(&tiny.buffer[0], tiny.size, false);
    write_header(&tiny.buffer[tiny.size + HEADER_BLOCKS], 0, true);
    store_operation(TINY_INIT, true, size);
}

// Clears the library buffer
void tiny_clear() {
    tiny.buffer = NULL;
    tiny.size = 0;
    store_operation(TINY_CLEAR, true, 0);
}

// Resets the library buffer to its initial value
void tiny_reset() {
    #ifdef TINY_BUFFER
    tiny.buffer = (tiny_block *)&tiny_buffer.buffer;
    tiny.size = (TINY_BUFFER / ALIGNMENT - 2 * HEADER_BLOCKS);
    #else
    tiny.buffer = NULL;
    tiny.size = 0;
    #endif
    store_operation(TINY_RESET, true, tiny.size);
}

// Sets the out-of-memory flag status. If set, calls to `malloc` and similar will
// return NULL always.
void tiny_out_of_memory(bool out_of_memory) {
    tiny.out_of_memory = out_of_memory;
}

// Returns the last operation performed by the library.
tiny_operation tiny_last_operation() {
    return tiny.last_operation;
}

// Gets the size of each block in the buffer (also, the library alignment)
size_t tiny_block_size() { return ALIGNMENT; }


// Prints a summary of the library
void tiny_print(bool summary, bool last_op, bool heap) {
    printf("\n");
    if(summary) {
        tiny_summary summ = tiny_inspect();
        printf(
            "\n|  Tiny summary  |\n\n"
            "Alignment: %lu\n"
            "Alignment type alias: %s\n"
            "Static buffer: [%p]\n"
            "Static buffer size: %lu\n"
            "Forced out-of-memory: %s\n"
            "Buffer: [%p]\n"
            "Buffer size: %lu blocks (%lu bytes)\n"
            "Free memory: %lu blocks (%lu bytes)\n"
            "Taken memory: %lu blocks (%lu bytes)\n"
            "Sections: %lu in total, %lu free, %lu taken\n",
            summ.alignment,
            summ.aligned_type,
            summ.static_buffer,
            summ.static_buffer_size,
            summ.out_of_memory ? "yes" : "no",
            summ.buffer,
            summ.total.blocks, summ.total.bytes,
            summ.free.blocks, summ.free.bytes,
            summ.taken.blocks, summ.taken.bytes,
            summ.sections.total, summ.sections.free, summ.sections.taken
        );
    }

    if(last_op) {
        printf(
            "\n|  Last tiny operation  |\n\n"
            "Operation: %s\n"
            "Status: %s\n"
            "Size: %lu\n", 
            operations[tiny.last_operation.function], 
            tiny.last_operation.success ? "success" : "failure",
            tiny.last_operation.size
        );
    }

    if(heap) {
        printf("\n|  Tiny heap  |\n\n");
        if(tiny.buffer == NULL || tiny.size == 0) {
            printf("Heap not allocated\n");
        } else {
            tiny_block *header = &tiny.buffer[0];
            tiny_block_section info = read_header(header);
            size_t i = 0;
            while(info.size > 0) {
                printf(
                    "Section %lu:\n"
                    "    Taken: %s\n"
                    "    Size: %lu blocks (%lu bytes)\n"
                    "    Header adddress: [%p]\n"
                    "    Data address: [%p]\n",
                    i++,
                    info.taken ? "yes" : "no",
                    info.size, info.size * ALIGNMENT,
                    (void *)info.header,
                    info.data
                );
                header = next_section(header);
                info = read_header(header);
            } 
            printf("No more sections\n");
        }
    }
}


tiny_summary tiny_inspect() {
    #ifdef TINY_BUFFER 
    void *static_buffer = (void *)&tiny_buffer;
    size_t static_buffer_size = TINY_BUFFER;
    #else
    void *static_buffer = NULL;
    size_t static_buffer_size = 0;
    #endif

    size_t free_blocks = 0, taken_blocks = 0;
    size_t total_sections = 0, free_sections = 0, taken_sections = 0;

    tiny_block *header = &tiny.buffer[0];
    if(header) {
        tiny_block_section section = read_header(header);
        while(section.size > 0) {
            total_sections++;
            if(section.taken) {
                taken_sections++;
                taken_blocks += section.size;
            } else {
                free_sections++;
                free_blocks += section.size;
            }
            header = next_section(header);
            section = read_header(header);
        }
    }

    tiny_summary summ = {
        ALIGNMENT,
        ALIGNED_TYPE,
        static_buffer,
        static_buffer_size,
        tiny.out_of_memory,
        tiny.buffer,
        { tiny.size, tiny.size * ALIGNMENT },
        { free_blocks, free_blocks * ALIGNMENT },
        { taken_blocks, taken_blocks * ALIGNMENT },
        { total_sections, free_sections, taken_sections }
    };
    return summ;
}


tiny_section tiny_next_section(void *previous_header) {
    if(tiny.buffer == NULL) {
        tiny_section info = { false, NULL, NULL, { 0, 0 } };
        return info;    
    }

    tiny_block *header = previous_header ? 
        next_section(previous_header) : 
        &tiny.buffer[0];
    tiny_block_section section = read_header(header);
    tiny_section info = {
        section.taken,
        section.size != 0 ? (void *)header : NULL,
        section.size != 0 ? (void *)(header + HEADER_BLOCKS) : NULL,
        { section.size, section.size * ALIGNMENT }
    };
    return info;
}

void *tiny_malloc(size_t size) {
    if(tiny.out_of_memory || tiny.buffer == NULL || size == 0) {
        store_operation(TINY_MALLOC, false, size);
        return NULL;
    }
    
    size_t aligned_size = ALIGN_SIZE(size);
    if(aligned_size < size) {
        store_operation(TINY_MALLOC, false, size);
        return NULL;
    }

    size_t blocks_required = aligned_size / ALIGNMENT;
    tiny_block *header = &tiny.buffer[0];
    tiny_block_section section = read_header(header);
    while(section.size > 0) {
        if(!section.taken && section.size >= blocks_required) {
            allocate_at(section, blocks_required);
            store_operation(TINY_MALLOC, true, size);
            return section.data;
        }
        header = next_section(header);
        section = read_header(header);
    } 
    store_operation(TINY_MALLOC, false, size);
    return NULL;
}

void *tiny_realloc(void *ptr, size_t size) {
    if(ptr == NULL) {
        void *data = tiny_malloc(size);
        store_operation(TINY_REALLOC, data != NULL, size);
        return data;
    }
    if(tiny.out_of_memory || tiny.buffer == NULL || size == 0) {
        store_operation(TINY_REALLOC, false, size);
        return NULL;
    }

    size_t blocks_required = ALIGN_SIZE(size) / ALIGNMENT;
    tiny_block *header = (tiny_block *)ptr - HEADER_BLOCKS;
    tiny_block_section section = read_header(header);
    tiny_block *next = next_section(header);
    tiny_block_section next_section = read_header(next);

    if(!next_section.taken && next_section.size >= blocks_required - section.size + HEADER_BLOCKS) {
        write_header(header, section.size + next_section.size + HEADER_BLOCKS, true);
        allocate_at(read_header(header), blocks_required);
        store_operation(TINY_REALLOC, true, size);
        return  ptr;
    } else {
        void *new_block = tiny_malloc(size);
        if(new_block) {
            memcpy(new_block, section.data, section.size * ALIGNMENT);
            tiny_free(ptr);
        }
        store_operation(TINY_REALLOC, new_block != NULL, size);
        return new_block;
    }
}

void *tiny_calloc(size_t num, size_t size) {
    size_t full_size = num * size;
    if(size == 0 || num == 0 || full_size / num != size) {
        store_operation(TINY_CALLOC, false, size);
        return NULL;
    }
    void *data = tiny_malloc(full_size);
    if(data != NULL) {
        memset(data, 0, full_size);
    }
    store_operation(TINY_CALLOC, data != NULL, num * size);
    return data;
}

void tiny_free(void *ptr) {
    if(ptr == NULL || tiny.buffer == NULL) {
        store_operation(TINY_FREE, false, 0);
        return;
    }

    tiny_block *current = (tiny_block *)ptr - HEADER_BLOCKS;
    tiny_block_section current_section = read_header(current);
    write_header(current, current_section.size, false);

    tiny_block *header = &tiny.buffer[0];
    tiny_block_section section = read_header(header);
    while(section.size > 0) {
        tiny_block *next = next_section(header);
        if(!section.taken) {
            tiny_block_section next_section = read_header(next);
            if(!next_section.taken) {
                write_header(header, section.size + next_section.size + HEADER_BLOCKS, false);
                section = read_header(header);
                continue;
            }
        }

        header = next;
        section = read_header(header);
    } 
    store_operation(TINY_FREE, true, current_section.size);
}
