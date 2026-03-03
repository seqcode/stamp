# STAMP v2.0

[STAMP](https://github.com/seqcode/stamp) is a tool for characterizing similarities between transcription factor binding motifs. STAMP includes both a command-line tool for motif comparison and a web platform for interactive analysis, visualization, and database matching.

You can also use the formatMotifs.pl script to convert the outputs from various motif-finders into the format used by STAMP.


## Building STAMP:

### Install the GNU Scientific Library:

 * Debian/Ubuntu and derivatives:
   ```bash
   sudo apt-get install libgsl0-dev
   ```
 * Red Hat/Fedora and derivatives:
   ```bash
   sudo yum install gsl-devel
   ```
 * If not available in your distribution repository, you can download and install it from source: http://www.gnu.org/software/gsl/.
   Add the **'include'** and **'lib'** directories to your **PATH**.


### Clone STAMP repository:

```bash
git clone https://github.com/seqcode/stamp

cd stamp
```


### Compile STAMP:

```bash
# Go to the src directory.
cd src

# Compile STAMP.
g++ -O3 -o ../stamp Motif.cpp Alignment.cpp ColumnComp.cpp \
    PlatformSupport.cpp PlatformTesting.cpp Tree.cpp \
    NeuralTree.cpp MultipleAlignment.cpp RandPSSMGen.cpp \
    ProteinDomains.cpp main.cpp -lm -lgsl -lgslcblas
```

**Note:** if the GSL library is not in the PATH, add the appropriate directories using the -L and -I compiler options.


## Running STAMP:

Run STAMP without arguments to see the various command-line options:

```bash
./stamp
```

When aligning motifs, a score distribution file for the chosen
settings must be provided. A selection of files for commonly
chosen settings should have come with STAMP in the "ScoreDists"
directory. The files are named using the following abbreviations
for alignment settings:

 * **go:** gap-open penalty
 * **ge:** gap-extend penalty
 * **SWA:** Smith-Waterman Alignment
 * **SWU:** Smith-Waterman Ungapped Alignment
 * **NW:** Needleman-Wunsch Alignment
 * **PCC:** Pearson's Correlation Coefficient
 * **SSD:** Sum of squared distance
 * **KL:** Kullback-Liebler
 * **ALLR:** Average Log Likelihood Ratio
 * **CS:** p-value of Chi-square

If you want to use settings (e.g gap parameters) that aren't supported
by the ScoreDists files, first generate 10000 random motifs using the
**-genrand** setting (I recommend using this with the JASPAR database
loaded using **-tf**), and then use the **-genscores** option with the
desired alignment settings.

### Example:

The file **"sample.motifs"** contains some test motifs in the format accepted
by STAMP.
	
Sample command to see if things are working:
```bash
./stamp -tf sample.motifs \
    -sd ./ScoreDists/JaspRand_PCC_SWU.scores \
    -cc PCC \
    -align SWU \
    -ma IR \
    -printpairwise \
    -match jaspar.motifs \
    -out outFile
```

The above command runs STAMP with the PCC metric, ungapped local
alignment, and iterative refinement multiple alignment. Pairwise
scores within the input set are printed. The input motifs are
"matched" against JASPAR and the results files all begin with the
name **"outFile"**.


## Formatting motifs for STAMP:

You can see the format used by STAMP in the file **"sample.motifs"**.
The format used by STAMP is derived from the format used by the
TransFac database. To convert other formats into STAMP's format,
you can use the formatMotifs.pl script as follows:

```bash
perl formatMotifs.pl inputFile outputFile
```

Note that converted motifs will be **appended** to outputFile, not
overwritten. Various input formats are detected and converted by
the **formatMotifs.pl** script.

[List of input formats](http://www.benoslab.pitt.edu/stamp/help.html#input):


## Web Server

STAMP v2.0 includes a web platform (in the `web/` directory) that wraps the STAMP command-line tool in an interactive application. Users can submit motif analysis jobs, visualize results, and match motifs against reference databases — all through a browser.

### Quick Start (Docker)

The easiest way to run the web platform is with Docker Compose:

```bash
cd web/docker
docker compose up
```

This starts the web server (port 3000), a background worker, MongoDB, and Redis. Copy `web/.env.example` to `web/.env.local` and configure as needed before starting.

### Quick Start (Development)

Prerequisites: Node.js >= 20, MongoDB, Redis, and the compiled STAMP binary.

```bash
cd web
cp .env.example .env.local   # edit with your local paths
npm install
npm run dev                   # Next.js dev server on port 3000
npm run worker:dev            # background job processor (separate terminal)
```

### Architecture Overview

The web platform is built with:

 * **Next.js 14** (App Router) — serves both the React frontend and REST API routes
 * **MongoDB** (via Mongoose) — stores jobs, results, and reference database metadata
 * **Redis + BullMQ** — asynchronous job queue for running STAMP analyses
 * **Worker process** — picks jobs from the queue, invokes the STAMP binary, parses output, and stores results

**Motif input** supports six formats: TRANSFAC, MEME, JASPAR, TF-MoDISco, consensus, and aligned FASTA. Formats are auto-detected on upload.

**Database matching** compares input motifs against reference databases synced from JASPAR, CIS-BP, HOCOMOCO v14, and Vierstra motif archetypes. An admin dashboard manages database synchronization.

**Results** include interactive D3-based sequence logos, a phylogenetic tree viewer, pairwise and multiple alignment viewers, and database match tables. Results can be downloaded as a self-contained HTML report or a ZIP archive.

### Directory Structure

```
web/
├── src/
│   ├── app/              # Next.js pages and API routes
│   │   ├── api/          #   REST endpoints (jobs, admin, databases, SSE)
│   │   ├── admin/        #   Admin dashboard
│   │   └── jobs/[jobId]/ #   Results page
│   ├── components/       # React components
│   │   ├── motif/        #   Sequence logos, motif input
│   │   ├── results/      #   Tree, alignment, match viewers
│   │   └── job/          #   Parameter form, database selector
│   ├── lib/              # Server-side logic
│   │   ├── motif/        #   Format parsers and converters
│   │   ├── stamp/        #   STAMP binary runner and output parser
│   │   ├── db/           #   Mongoose models (Job, ReferenceDatabase)
│   │   ├── queue/        #   BullMQ queue setup
│   │   ├── auth/         #   Session management, rate limiting
│   │   ├── export/       #   HTML report and logo rendering
│   │   └── jaspar/       #   Reference database sync clients
│   │       cisbp/
│   │       hocomoco/
│   │       vierstra/
│   └── types/            # TypeScript type definitions
├── worker/               # Background job processor
└── docker/               # Dockerfile and docker-compose configs
```


## Version history:

 * **v2.0:** 2026-03-03:
    * Added a web platform for interactive motif analysis (`web/` directory).
    * Multi-format motif input with auto-detection (TRANSFAC, MEME, JASPAR, TF-MoDISco, consensus, aligned FASTA).
    * Interactive D3-based sequence logo visualization with export options.
    * Asynchronous job processing via BullMQ/Redis queue with real-time progress updates (SSE).
    * Database matching against JASPAR, CIS-BP, HOCOMOCO v14, and Vierstra motif archetypes.
    * Admin dashboard for syncing and managing reference databases.
    * Results page with phylogenetic tree viewer, pairwise/multiple alignment viewers, and match tables.
    * Downloadable self-contained HTML report and ZIP archive of results.
    * Optional email notifications on job completion.
    * Docker Compose deployment with multi-stage builds.
    * Security hardening: Redis-backed sessions, rate limiting, CSRF protection, XSS prevention.

 * **v.1.3:** 2016-09-23:
    * Make parsing of STAMP specific TRANSFAC file more robust.
      Before this change STAMP only processes TRANSFAC files
      correctly when they looked exactly like this:
        - motif starts with tag "DE  motif_name".
        - "DE" tag is directly followed by matrix lines
          (no "P0" or "PO" tag allowed).
        - matrix lines are directly followed by a "XX" tag line.
        - if other tags are present between "DE" and matrix lines or between matrix
          lines and "XX", STAMP adds for each of those lines "0.0  0.0  0.0  0.0"
          to the matrix (which was wrong).
 * **v.1.2:** 2015-05-27:
    * This version includes bug fixes and updated compilation instructons
      that [Gert Hulselmans (KU Leuven)](https://github.com/ghuls/) performed
      in Oct 2013. We're very grateful to Gert for getting this code working
      again.
    * This version also includes a new option for restricting motif
      comparisons to a single strand (e.g. for comparing RNA-binding motifs). 

 * **v.1.1 and earlier:** 2006 - 2008:
    * STAMP was written by [Shaun Mahony](http://mahonylab.org/) during
      his time as a postdoc in
      [Takis Benos' lab at the University of Pittsburgh](http://www.benoslab.pitt.edu). 


## Citations:

 * [**STAMP: a web tool for exploring DNA-binding motif similarities**
	S Mahony, PV Benos
	*Nucleic Acids Research (2007) 35(Web Server issue):W253-W258*
   ](http://www.ncbi.nlm.nih.gov/pubmed/17478497)
 * [**DNA familial binding profiles made easy: comparison of various motif alignment and clustering strategies**
	S Mahony, P Auron, PV Benos
	*PLoS Computational Biology (2007) 3(3):e61*
    ](http://www.ncbi.nlm.nih.gov/pubmed/17397256)


## Contact details:

 * Mahony Lab: https://mahonylab.org/
 * GitHub: https://github.com/seqcode/stamp
 * Legacy STAMP website: http://www.benoslab.pitt.edu/stamp/

