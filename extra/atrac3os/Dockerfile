FROM ubuntu:24.04

ARG BUILD_ROOT_RELEASE=2025.02

COPY ./buildroot-v86 /buildroot-v86

# Install all Buildroot deps
RUN sed -i 's|deb http://us.archive.ubuntu.com/ubuntu/|deb mirror://mirrors.ubuntu.com/mirrors.txt|g' /etc/apt/sources.list; \
    dpkg --add-architecture i386; \
    rm -rf /var/lib/apt/lists/*; \
    apt-get -q update;

WORKDIR /root
RUN DEBIAN_FRONTEND=noninteractive apt-get -q -y install \
    file \
    vim \
    bc \
    build-essential \
    bzr \
    cpio \
    cvs \
    git \
    unzip \
    wget \
    libc6:i386 \
    libncurses5-dev \
    libssl-dev \
    rsync; \
    wget -c http://buildroot.org/downloads/buildroot-${BUILD_ROOT_RELEASE}.tar.gz; \
    tar axf buildroot-${BUILD_ROOT_RELEASE}.tar.gz;

# configure the locales
ENV LANG='C' \
    LANGUAGE='en_US:en' \
    LC_ALL='C' \ 
    NOTVISIBLE="in users profile" \
    TERM=xterm \
    BUILD_ROOT_RELEASE=${BUILD_ROOT_RELEASE}

# Buildroot will place built artifacts here at the end.
VOLUME /build

WORKDIR /root/buildroot-${BUILD_ROOT_RELEASE}

ENTRYPOINT ["/buildroot-v86/build-v86.sh"]
