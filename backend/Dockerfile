FROM docker.io/library/debian:bookworm as builder

RUN apt-get update -o Acquire::Retries=5 && apt-get install -y \
    build-essential \
    cmake \
    git \
    libssl-dev \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install oatpp
RUN git clone https://github.com/oatpp/oatpp.git && \
    cd oatpp && git checkout 1.3.0 && \
    mkdir build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make install

# Install oatpp-postgresql
RUN git clone https://github.com/oatpp/oatpp-postgresql.git && \
    cd oatpp-postgresql && git checkout 1.3.0 && \
    mkdir build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make install

# Copy and build our application
COPY . /app
WORKDIR /app
RUN mkdir build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make

# Runtime image
FROM docker.io/library/debian:bookworm-slim

RUN apt-get update -o Acquire::Retries=5 && apt-get install -y \
    libssl3 \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib /usr/local/lib
COPY --from=builder /app/build/investment_tracker /app/investment_tracker

ENV LD_LIBRARY_PATH=/usr/local/lib

EXPOSE 3001

CMD ["/app/investment_tracker"]
