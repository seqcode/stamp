# STAMP v.1.3.

[STAMP](http://www.benoslab.pitt.edu/stamp/) is a tool for characterizing similarities between transcription factor binding motifs. 

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


## Version history:

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

 * Personal website: http://mahonylab.org/
 * STAMP website: http://www.benoslab.pitt.edu/stamp/
 * Download STAMP:
     * https://github.com/seqcode/stamp
     * http://www.csb.pitt.edu/Faculty/benos/?page_id=51

