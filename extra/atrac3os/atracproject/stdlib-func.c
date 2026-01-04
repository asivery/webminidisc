void *memcpy(void *_destination, const void *_source, unsigned int count) {
    char *destination = _destination;
    const char *source = _source;
    for(unsigned int i = 0; i<count; i++) *destination++ = *source++;
    return _destination;
}

void *memmove(void *destination, const void *source, unsigned int count) {
    char *temp = malloc(count);
    memcpy(temp, source, count);
    memcpy(destination, temp, count);
    free(temp);
    return destination;
}

void *memset(void *_dest, int _ch, unsigned int value) {
    char *dest = _dest, ch = _ch;
    for(unsigned int i = 0; i < value; i++) *dest++ = ch;
    return _dest;
}

long int labs(long int x) {
    if(x > 0) return x;
    return -x;
}

int abs(int x) {
    if(x > 0) return x;
    return -x;
}

int __attribute__((naked)) puts(const char *data) {
    __asm__ volatile("jmp print");
}

int printf(const char *format, ...) {
    print("Printf!!");
    print(format);
    return 0;
}

int putchar(int c) {
    print("Putchar!");
    char buf[2];
    buf[0] = c;
    buf[1] = 0;
    print(buf);
    return c;
}
