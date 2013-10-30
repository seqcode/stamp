//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// PlatformSupport.h
//
// Started: 1st Nov 2005
//
// Copyright 2007 Shaun Mahony
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


#ifndef PLAT_MARK
#define PLAT_MARK

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "globals.h"
#include "Motif.h"
#include "Alignment.h"


//Supporting class
class PlatformSupport
{
private:
	int matCount;
	int matchDBSize;
	bool backgroundSet;
	double total_weight;

public:
	//The Markov models of the background
	double** markov;
	//The highest order of Markov models in the above matrix
	int backgroundOrder;
	//the related charmap for x-mers
	char*** charMap;
	//Score means
	double** scoreDistMean;
	//Score StdDevs
	double** scoreDistStdDev;
	//Score maxs
	double** scoreDistMax;
	//Score mins
	double** scoreDistMin;
	//Using the weighting in FBPs
	bool usingWeighting;

	//Constructor
	PlatformSupport();

	//The matrices themselves
	Motif* inputMotifs[MAX_MOTIFS];
	Motif* matchMotifs[MAX_MOTIFS];
	//Pairwise alignments of the matrices
	AlignRec** pairwiseAlign;

	//Accessors
	int GetMatCount(){return matCount;}
	int GetMatchDBSize(){return matchDBSize;}
	double GetTotalWeight(){return total_weight;}

	//Read in a background model
	void ReadBackground(char* fn=NULL);

	//Read in a TransFac file
	int ReadTransfacFile(char* fn, bool famNames=false, bool input=true, bool useweighting=false);

	//Read in a score distribution file
	void ReadScoreDists(char* fn);

	//Find the distribution of alignment scores in the input set and print them to a file
	void GetRandDistrib(char* fn, Alignment* A_man);

	//Convert scores given an appropriate distribution
	double Score2ZScore(int len1, int len2, double score);
	double Score2PVal(int len1, int len2, double score);
	double Score2Dist(int len1, int len2, double score, double maxScore);

	//Align all matrices against all others
	void PreAlign(Alignment* A_man);

	//Print the pairwise alignments
	void PrintPairwise();

	//Find the best matching motifs in the match set and print the pairs to a file
	void SimilarityMatching(Alignment* A_man, char* outFileName, bool famNames, const int matchTopX);

	//Motif helpers
	//Convertors for f
	void n_to_pwm(Motif* m);
	void f_to_n(Motif* m);
	//information content
	double InfoContent(Motif* m);

	//log base 2
	double log_2(double x);

	//Destructor
	~PlatformSupport();
};

#endif 
