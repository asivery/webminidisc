CC += -m32 -fPIC
program.so: tiny.o wrapper.o
	${CC} -shared -o program.so wrapper.o tiny.o

wrapper.o: program.c stdlib-func.c atrac.h configs.c
	${CC} -c -o wrapper.o program.c

tiny.o: tiny.c tiny.h
.PHONY: clean
clean:
	rm *.o *.so
