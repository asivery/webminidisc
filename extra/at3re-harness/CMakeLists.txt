cmake_minimum_required(VERSION 3.20)
project(at3re-harness C)

# For now, this project remains private:
add_subdirectory(at3re)

add_executable(at3re-harness src/test.c src/configs.c src/lib.c)
target_include_directories(at3re-harness PRIVATE at3re/src)
target_link_libraries(at3re-harness PRIVATE atrac)

if(EMSCRIPTEN)
    target_link_options(at3re-harness PRIVATE
        -sEXPORTED_FUNCTIONS=['_malloc','_free','_initialize','_encode','_finish','_calculate_atrac_buf_size','ccall'])
    target_link_options(at3re-harness PRIVATE
        -sEXPORTED_RUNTIME_METHODS=['HEAPU8'])
    target_link_options(at3re-harness PRIVATE  -sMODULARIZE=1)
    target_link_options(at3re-harness PRIVATE  -sALLOW_MEMORY_GROWTH=1)
    target_link_options(at3re-harness PRIVATE  -sSTACK_SIZE=5242880)
endif()
