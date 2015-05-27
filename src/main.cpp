//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1.2
//
// Written By: Shaun Mahony
// Bug fixes by: Gert Hulselmans
//
// main.cpp
//
// Started: 31st Oct 2005
//
// Copyright 2007-2015 Shaun Mahony
//
// This file is part of STAMP.
//
// STAMP is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// STAMP is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with STAMP; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
//
////////////////////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include <stdlib.h>

#include "Alignment.h"
#include "ColumnComp.h"
#include "PlatformSupport.h"
#include "PlatformTesting.h"
#include "RandPSSMGen.h"
#include "Tree.h"
#include "NeuralTree.h"
#include "MultipleAlignment.h"
#include "ProteinDomains.h"

void DisplayHelp();

int main (int argc, char *argv[])
{
	int i;
	PlatformSupport* Plat = new PlatformSupport();
    ColumnComp* CC;
	Alignment* ALIGN;
	Tree* T;
	MultipleAlignment* MA;
	ProteinDomains* PROTS =NULL;
	MultiAlignRec* pssmAlignment;
	char outFileName[STR_LEN];
	strcpy(outFileName, "out");
    bool colChosen=false, alignChosen=false, treeChosen=false, maChosen=false, usingDomains=false, inputProvided=false, scoresProvided=false;
	bool neuralTree=false; bool testing=false;bool testingAcc=false; bool testingTree=false; bool famNames=false; bool treeClusts=false; bool printTreeClusts=false;
	bool ma_off=false;
	bool tree_loocv=false;//true;
	bool silent=false, htmlOutput=false; bool simMatching=false;
	bool weighting_on=false;
	int matchTopX = TOP_MATCH;

	char inputTFs[STR_LEN];
	char matchTFs[STR_LEN];
	char scoreDist[STR_LEN];
	char inputProteins[STR_LEN];

	//Misc option settings
	bool genRandMotifs=false;
	bool genRandScores=false;
	char randMatOut[STR_LEN];
	char scoresOut[STR_LEN];
	//Default alignment settings
	double gapOpen = DFLT_GAP_OPEN;
	double gapExtend = DFLT_GAP_EXTEND;
	bool overlapAlign = DFLT_OVLP_ALIGN;
	bool extendOverlap=false;
	bool FBP_on = false;
	bool preAlign=false;
	bool pairwiseOnly=false;
	bool forwardAlignOnly=false;
	bool ungapped=false;

	for(i=1; i<argc; i++){
		if(strcmp(argv[i], "-silent")==0)
			silent=true;
		if(strcmp(argv[i], "-html")==0)
			htmlOutput=true;
	}

	//Welcome message
	if(!silent && !htmlOutput){printf("\n\tSTAMP\n\tSimilarity, Tree-building, & Alignment of Motifs and Profiles\n\n\tShaun Mahony\n\tDepartment of Biochemistry & Molecular Biology\n\tPenn State University\n\tVersion 1.2 (May 2015)\n\n");}

	if(argc ==1) //First and Foremost, the help option
	{	DisplayHelp();
	}else{

	for(i=1; i<argc; i++)
	{
		if(strcmp(argv[i], "-h")==0 || strcmp(argv[i], "?")==0) //First and Foremost, the help option
		{	DisplayHelp();
		}
		if(strcmp(argv[i], "-out")==0) //Output file (for trees & similarity matching)
		{	if(argv[i+1]!=NULL)
			{ strcpy(outFileName, argv[i+1]);}
		}
		if(strcmp(argv[i], "-genrand")==0) //Generate random motifs
		{	if(argv[i+1]!=NULL)
			{ strcpy(randMatOut, argv[i+1]);}
			genRandMotifs=true;
		}
		if(strcmp(argv[i], "-genscores")==0) //Generate simulation scores
		{	if(argv[i+1]!=NULL)
			{ strcpy(scoresOut, argv[i+1]);}
			genRandScores=true;
		}
		if((strcmp(argv[i], "-cc")) ==0)  //Choose a column comparison measure
		{
			if((strcmp(argv[i+1], "PCC"))==0 || (strcmp(argv[i+1], "pcc"))==0){
				CC = new PearsonCorrelation(); //Pearson's correllation coefficient
			}else if((strcmp(argv[i+1], "ALLR"))==0 || (strcmp(argv[i+1], "allr"))==0){
				CC = new ALLR(); //ALLR
			}else if((strcmp(argv[i+1], "ALLR_LL"))==0 || (strcmp(argv[i+1], "allr_ll"))==0){
				CC = new ALLR_LL(); //ALLR with lower limit
			}else if((strcmp(argv[i+1], "CS"))==0 || (strcmp(argv[i+1], "cs"))==0){
				CC = new ChiSq(); //Pearson's Chi Square
			}else if((strcmp(argv[i+1], "KL"))==0 || (strcmp(argv[i+1], "kl"))==0){
				CC = new KullbackLieber(); //Kullback-Lieber
			}else if((strcmp(argv[i+1], "SSD"))==0 || (strcmp(argv[i+1], "ssd"))==0){
				CC = new SumSqDiff(); //sum of squared difference
			}else{
				CC = new PearsonCorrelation(); //Default = PCC
			}
			colChosen=true;
		}
		//check for alignment settings
		if((strcmp(argv[i], "-go")) ==0){ //Gap Open
			if(argv[i+1]!=NULL)
			{	gapOpen=strtod(argv[i+1], NULL);}
		}
		if((strcmp(argv[i], "-ge")) ==0){ //Gap Extend
			if(argv[i+1]!=NULL)
			{	gapExtend=strtod(argv[i+1], NULL);}
		}
		if((strcmp(argv[i], "-overlapalign")) ==0){ //Only complete overlapping alignments
			overlapAlign = true; if(!silent && !htmlOutput){printf("Overlapping alignments only\n");}
		}if((strcmp(argv[i], "-nooverlapalign")) ==0){ //All overlapping alignments
			overlapAlign = false;
		}
		if((strcmp(argv[i], "-extendoverlap")) ==0){
			extendOverlap=true; if(!silent && !htmlOutput){printf("Extending the overlapping alignments\n");}
		}
		if((strcmp(argv[i], "-forwardonly")) ==0){ //Consider forward alignments only
			forwardAlignOnly = true;
			if(!silent && !htmlOutput){printf("Considering forward direction alignments only\n");}
		}
		if((strcmp(argv[i], "-printpairwise")) ==0){
			pairwiseOnly=true; if(!silent && !htmlOutput){printf("Printing pairwise scores only\n");}
		}
		if((strcmp(argv[i], "-FBP")) ==0){
			FBP_on=true; if(!silent && !htmlOutput){printf("Using FBP profiles\n");}
		}
		if((strcmp(argv[i], "-useweighting")) ==0){
			weighting_on=true; if(!silent && !htmlOutput){printf("Using weighting in FBP construction\n");}
		}
		if((strcmp(argv[i], "-prealigned")) ==0){
			preAlign=true; if(!silent && !htmlOutput){printf("Profiles are pre-aligned\n");}
		}

		//Input TF dataset name
		if((strcmp(argv[i], "-tf")) ==0)
		{	if(argv[i+1]!=NULL)
			{ strcpy(inputTFs, argv[i+1]);}
			inputProvided=true;
		}
		//Score distribution file   Make an auto function for this!!!!!!!
		if((strcmp(argv[i], "-sd")) ==0)
		{	if(argv[i+1]!=NULL)
			{ strcpy(scoreDist, argv[i+1]);}
			scoresProvided=true;
		}
		//Match input TFs against this dataset
		if((strcmp(argv[i], "-match")) ==0)
		{	if(argv[i+1]!=NULL)
			{ strcpy(matchTFs, argv[i+1]);}
			if(argv[i+2]!=NULL && strcmp(argv[i+2], "fams")==0){
				famNames=true;
			}
			simMatching=true;
		}
		if((strcmp(argv[i], "-match_top")) ==0){ //Report the top X matches
			if(argv[i+1]!=NULL)
			{	matchTopX=strtol(argv[i+1], NULL, 10);}
		}
		//Matching input protein (Pfam) alignment dataset name
		if((strcmp(argv[i], "-prot")) ==0)
		{	if(argv[i+1]!=NULL)
			{ strcpy(inputProteins, argv[i+1]);}
			usingDomains = true;
		}
		//Run some tests
		if((strcmp(argv[i], "-test")) ==0)
		{	testing=true;
		}
		//Run some different tests
		if((strcmp(argv[i], "-testacc")) ==0)
		{	testingAcc=true;
			famNames=true;
		}
		//Run some tests with trees
		if((strcmp(argv[i], "-testtree")) ==0)
		{	testingTree=true;
			famNames=true;
		}//Run Calinski & Harabasz with trees
		if((strcmp(argv[i], "-ch")) ==0)
		{	testingTree=true; treeClusts=true;
		}//Run Calinski & Harabasz with trees and print the resulting clusters
		if((strcmp(argv[i], "-chp")) ==0)
		{	testingTree=true;
			printTreeClusts=true; treeClusts=true;
		}
	}
	//Defaults
	if(!colChosen)
	{	CC = new PearsonCorrelation();}

	//Second Pass
	for(i=1; i<argc; i++)
	{
		if((strcmp(argv[i], "-align")) ==0)  //Choose an alignment method
		{
			if((strcmp(argv[i+1], "NW"))==0 || (strcmp(argv[i+1], "nw"))==0){
				ALIGN = new NeedlemanWunsch(CC, gapOpen, gapExtend, overlapAlign, extendOverlap, forwardAlignOnly);
			}
			if((strcmp(argv[i+1], "SWU"))==0 || (strcmp(argv[i+1], "swu"))==0){
				ALIGN = new SmithWatermanUngappedExtended(CC, forwardAlignOnly); ungapped=true;
			}
			if((strcmp(argv[i+1], "SWA"))==0 || (strcmp(argv[i+1], "swa"))==0){
				ALIGN = new SmithWatermanAffine(CC, gapOpen, gapExtend, overlapAlign, extendOverlap, forwardAlignOnly);
			}
			if((strcmp(argv[i+1], "SW"))==0 || (strcmp(argv[i+1], "sw"))==0){
				ALIGN = new SmithWaterman(CC, gapOpen, gapExtend, overlapAlign, extendOverlap, forwardAlignOnly);
			}
			alignChosen = true;
		}
		//Choose a multiple alignment method
		if((strcmp(argv[i], "-ma")) ==0)
		{
			if((strcmp(argv[i+1], "PPA"))==0 || (strcmp(argv[i+1], "ppa"))==0){
				MA = new ProgressiveProfileAlignment(outFileName, htmlOutput);
				maChosen=true;
			}
			if((strcmp(argv[i+1], "IR"))==0 || (strcmp(argv[i+1], "ir"))==0){
				MA = new IterativeRefinementAlignment(outFileName, htmlOutput);
				maChosen=true;
			}
			if((strcmp(argv[i+1], "NONE"))==0 || (strcmp(argv[i+1], "none"))==0){
				maChosen=true; ma_off=true;
			}
		}
	}
	if(!alignChosen)
	{	ALIGN = new SmithWatermanAffine(CC, gapOpen, gapExtend, overlapAlign, extendOverlap, forwardAlignOnly);
	}
	if(!maChosen)
		MA = new ProgressiveProfileAlignment(outFileName, htmlOutput);
	//Third pass
	//Choose a tree-construction method
	for(i=1; i<argc; i++)
	{	if((strcmp(argv[i], "-tree")) ==0)
		{
			if((strcmp(argv[i+1], "UPGMA"))==0 || (strcmp(argv[i+1], "upgma"))==0){
				T = new UPGMA(ALIGN);
			}
			if((strcmp(argv[i+1], "SOTA"))==0 || (strcmp(argv[i+1], "sota"))==0){
				T = new SOTA(ALIGN, MA); neuralTree=true;
			}
			if((strcmp(argv[i+1], "NJ"))==0 || (strcmp(argv[i+1], "nj"))==0){
				T = new Neighbourjoin(ALIGN); printf("Using Neighbour-joining... ensure that the distance metric is additive\n");
			}
			if((strcmp(argv[i+1], "TDHC"))==0 || (strcmp(argv[i+1], "tdhc"))==0){
				T = new TopDownHClust(ALIGN, MA); neuralTree=true;
			}
			treeChosen=true;
		}
	}
	if(!treeChosen)
		T = new UPGMA(ALIGN);
	T->BeQuiet(silent);

////////////////////////////////////////////////////////////////////////////////////
//////// Main Program /////////////////////////////////////////////////////////////

	//Initialise the background
	Plat->ReadBackground();
	if(inputProvided){
		//Read in the matrices
		Plat->ReadTransfacFile(inputTFs, famNames,true, weighting_on);
		if(!silent && !htmlOutput){
			printf("MatCount: %d\n", Plat->GetMatCount());
			if(ungapped)
				printf("Ungapped Alignment\n");
			else
				printf("Gap open = %.3lf, gap extend = %.3lf\n", gapOpen, gapExtend);
		}
	}else{
		printf("No input motifs provided!\n\n");
	}
	if(genRandMotifs){
		//Generate some random matrices
		RandPSSMGen* RPG = new RandPSSMGen(Plat->inputMotifs, Plat->GetMatCount(), 10000, randMatOut);
		RPG->RunGenerator();
	}
	if(genRandScores){
		//Find rand dist
		Plat->GetRandDistrib(scoresOut, ALIGN);
	}else if(!scoresProvided){
		printf("No score distribution file provided!\n\n");
	}
	if(testing){
		PlatformTesting* PT = new PlatformTesting(CC);
		//Print the distribution of column depth
	//	PT->ColumnDepthDist(Plat->inputMotifs, Plat->GetMatCount());
		//Print the similarities of all columns against all others
	//	PT->ColumnScoreDist(Plat->inputMotifs, Plat->GetMatCount(), 0.05);
		double z;
		for(z=0.25; z<0.8; z+=0.05)
			PT->RandColumns(Plat, z);
		for(z=0.8; z<=1.0; z+=0.01)
			PT->RandColumns(Plat, z);
		delete(PT);
	}

	if(scoresProvided || preAlign){

		Plat->ReadScoreDists(scoreDist);
		if(!silent && !htmlOutput){printf("Scores read\n");}
		if(Plat->GetMatCount()>1){
			if(preAlign){
				//No alignments or trees built here
				pssmAlignment = MA->PreAlignedInput(Plat);
			}else{
				//Multiple alignment procedure
				Plat->PreAlign(ALIGN);
				if(pairwiseOnly){
					if(!silent && !htmlOutput){printf("\nPairwise alignment scores:\n");}
					Plat->PrintPairwise();
				}if(!ma_off){
					MA->ImportBasics(Plat, ALIGN);
					if(!silent && !htmlOutput){printf("Alignments Finished\n");}
					if(!testingAcc){
						if(tree_loocv && testingTree){
							T->LOOCVBuildTree(Plat, testingTree);
						}else{
							if(testingTree && !silent && !htmlOutput){printf("Calinski & Harabasz:\n\tNumClust\tC&H_Metric\n");}
							T->BuildTree(Plat, testingTree);
							if(!silent && treeClusts){printf("The Calinski & Harabasz statistic suggests %.0lf clusters in the input motifs\n", T->GetNodesMinCH());}
							if(printTreeClusts){
								T->PrintLevel(outFileName, int(T->GetNodesMinCH()));
							}
						}
						T->PrintTree(outFileName);

						if(!silent && !htmlOutput){printf("Tree Built\n");}

						if(!silent){
							if(!silent && !htmlOutput){printf("Multiple Alignment:\n");}
							pssmAlignment = MA->BuildAlignment(Plat, ALIGN, T);
						}
					}
				}
			}

			//Experiment with the Protein Domains
			if(usingDomains){
				PROTS = new ProteinDomains();
				PROTS->ReadDomains(inputProteins, Plat->inputMotifs, Plat->GetMatCount());
				PROTS->MutualInformation(pssmAlignment, MA->Alignment2Profile(pssmAlignment, "AlignmentMotif"), Plat->inputMotifs, Plat->GetMatCount());
				delete PROTS;
			}
		}
		//Similarity match against the database
		if(simMatching){
			Plat->ReadTransfacFile(matchTFs, famNames, false, false);
			Plat->SimilarityMatching(ALIGN, outFileName, famNames, matchTopX);
		}
	}

	if(testingAcc && scoresProvided && inputProvided && Plat->GetMatCount()>1){
		PlatformTesting* PT = new PlatformTesting(CC);
		PT->PairwisePredictionAccuracy(Plat);
	}

	delete(MA);
	delete(T);
	delete(CC);
	delete(ALIGN);
	}
delete(Plat);
return(0);
}



//Display the input options
void DisplayHelp()
{
	printf("\tUsage:\n\n");
	printf("\t-h\n\t\tDisplay this message\n");
	printf("\t-tf [input file]\n\t\tInput dataset of motifs in TRANSFAC format [required!]\n");
	printf("\t-sd [score file]\n\t\tInput file with random score distributions [required!]\n");
	printf("\t-cc [metric name]\n\t\tColumn comparison metric.\n\t\tOptions:\n\t\tPCC:\tPearson Correlation Coefficient [default]\n\t\tALLR:\tAverage Log-Likelihood Ratio\n\t\tALLR_LL:\tALLR with low score limit of 2\n\t\tCS:\tChi-Squared\n\t\tKL:\tKullback-Lieber\n\t\tSSD:\tSum of Squared Distances\n");
	printf("\n\t*** Alignment Methods ***\n");
	printf("\t-align [method name]\n\t\tAlignment method choice.\n\t\tOptions:\n\t\tNW:\tNeedleman-Wunsch\n\t\tSW:\tSmith-Waterman (linear gaps)\n\t\tSWA:\tSmith-Waterman (affine gaps) [default]\n\t\tSWU:\tSmith-Waterman (ungapped & alignments are extended)\n");
	printf("\t-go [x]\n\t\tGap open penalty (Default = %.2lf)\n", DFLT_GAP_OPEN);
	printf("\t-ge [x]\n\t\tGap extension penalty (Default = %.2lf)\n", DFLT_GAP_EXTEND);
	printf("\t-overlapalign\n\t\tOnly allow overlapping alignments\n\t\tMin. length: %d. Default = ON\n", MIN_OVERLAP);
	printf("\t-nooverlapalign\n\t\tAllow partial (non-overlapping) alignments\n");
	printf("\t-extendoverlap\n\t\tExtend the edges of the alignments to cover both motifs [Default = OFF]\n");
	printf("\t-forwardonly\n\t\tConsider forward direction alignments only [Default = OFF]\n");
	printf("\t-printpairwise\n\t\tOnly print the pairwise scores [Default = OFF]\n");
	printf("\n\t*** Tree-Building Methods ***\n");
	printf("\t-tree [method name]\n\t\tTree construction method choice.\n\t\tOptions:\n\t\tUPGMA:\tUnweighted Pair Group Method with Arithmetic Mean [default]\n\t\tSOTA:\tSelf-Organizing Tree Algorithm\n");
	printf("\t-ch\n\t\tCalculate Calinski & Harabasz tree cluster number statistic with the UPGMA tree.\n");
	printf("\t-chp\n\t\tCalculate Calinski & Harabasz statistic and output the resulting clusters to a file.\n");
	printf("\n\t*** Multiple Alignment Methods ***\n");
	printf("\t-ma [method name]\n\t\tMultiple alignment method choice.\n\t\tOptions:\n\t\tPPA:\tProgressive Profile Alignment [default]\n\t\tIR:\tIterative Refinement\n");
	printf("\n\t*** Similarity Matching ***\n");
	printf("\t-match [TF matrix file]\n\t\tMatch the input PSSMs against this dataset.\n");
	printf("\t-match_top [x]\n\t\tFind the top X matches.\n");
	printf("\n\t*** Mutual Information ***\n");
	printf("\t-prot [protein file]\n\t\tProvide a file of protein alignments (Pfam format)\n\t\tto begin mutual information scan.\n");
	printf("\t-prealigned\n\t\tSet this flag if the motifs are prealigned.\n\t\tAlignment is skipped and mutual information scan begins\n");
	printf("\n\t*** Support Options ***\n");
	printf("\t-genrand [output file]\n\t\tGenerate 10000 random motifs and store them in the output file\n");
	printf("\t-genscores [output file]\n\t\tGenerate expected scores based on simulated motifs and store them in the output file\n");
	printf("\n\n");
}

