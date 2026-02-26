# Stage 1: Compile STAMP binary
FROM ubuntu:22.04 AS stamp-builder

RUN apt-get update && \
    apt-get install -y g++ libgsl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY src/ ./src/

WORKDIR /build/src
RUN g++ -O3 -o /build/stamp \
    Motif.cpp Alignment.cpp ColumnComp.cpp \
    PlatformSupport.cpp PlatformTesting.cpp Tree.cpp \
    NeuralTree.cpp MultipleAlignment.cpp RandPSSMGen.cpp \
    ProteinDomains.cpp main.cpp \
    -lm -lgsl -lgslcblas

# Stage 2: Build Next.js application
FROM node:22-alpine AS app-builder

WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 3: Production image
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y libgsl27 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy STAMP binary and score distributions
COPY --from=stamp-builder /build/stamp /app/stamp
COPY ScoreDists/ /app/ScoreDists/

# Copy Next.js standalone build
COPY --from=app-builder /app/.next/standalone ./
COPY --from=app-builder /app/.next/static ./.next/static
COPY --from=app-builder /app/public ./public

# Create data directory
RUN mkdir -p /app/data/jobs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]
