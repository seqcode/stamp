//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// Alignment.h
//
// Started: 31st Oct 2005
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


#ifndef ALIGN_MARK
#define ALIGN_MARK


//Includes
#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include "Motif.h"
#include "ColumnComp.h"
#include "globals.h"


//Cell struct
struct AlignMatCell{
public:
	double M;
	double Ix;
	double Iy;
	double max;
	int point_i;
	int point_j;
};

//Alignment record
class AlignRec{
private: 
	int alignL;
	int numAligned;
public:
	int** alignSection;
	int i1;
	int i2;
	bool forward1;
	bool forward2;
	double score;
	double z_score;
	double p_value;
	double dist;
	char** alignedNames;
	int* alignedIDs;

	//Constructor
	AlignRec(int nA=2, int aL=0);

	//Accessors
	int GetAlignL(){return alignL;}
	int GetNumAligned(){return numAligned;}

	//Copy the alignment section
	void CopyAlignSec(int** AS, int aL, int nA=2);

	//Destructor
	~AlignRec(){if(alignSection!=NULL){
		for(int i=0; i<numAligned; i++){
			delete [] alignSection[i];
			delete [] alignedNames[i];
		}delete [] alignSection;
		delete [] alignedNames;
		delete [] alignedIDs;
	}}
};

//Alignment record
class MultiAlignRec{
private: 
	int alignL;
	int numAligned;
public:
	Motif** profileAlignment;
	char** alignedNames;
	int* alignedIDs;

	//Constructor
	MultiAlignRec(int nA=2, int aL=0);

	//Accessors
	int GetAlignL(){return alignL;}
	int GetNumAligned(){return numAligned;}

	//Destructor
	~MultiAlignRec(){
		for(int i=0; i<numAligned; i++){
			delete profileAlignment[i];
		}delete [] profileAlignment;
		for(int k=0; k<numAligned; k++)
			delete [] alignedNames[k];
		delete [] alignedNames;
		delete [] alignedIDs;
	}
};

//Alignment method
class Alignment 
{	
protected:
	double gapOpen;
	double gapExtend;
	int alignLen;
	bool alignForward;
	double alignScore;
	ColumnComp* Metric;
	bool overlapOnly;
	bool extendOverlap;
	int** alignSectionTmp;

	//Helper methods
	double Info(double* col);

public:
	//The alignment section
	int** alignSection;

	//Constructor
	Alignment(ColumnComp* c, double gO = DFLT_GAP_OPEN, double gE = DFLT_GAP_EXTEND, bool overlap = false, bool extend=false);

	//Accessors
	int GetAlignLen(){return alignLen;}

	//Align
	virtual double AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward)=0;
	//Two sweeps of AlignMotifs
	double AlignMotifs2D(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward1, bool& forward2);

	//Print the current alignment section
	void PrintAlignmentConsensus(Motif* one, Motif* two);

	//Copy the current alignment section to provided strings
	void CopyAlignmentConsensus(Motif* one, Motif* two, char* str_one, char* str_two);

	//Trim edges of a motif
	Motif* TrimEdges(Motif* in, int &start_offset, int &stop_offset, int minLen=IC_win_len, bool allowExclusive=false);

	//Destructor 
	virtual ~Alignment(){for(int i=0; i<2; i++){delete alignSection[i];delete alignSectionTmp[i];} delete alignSection;delete alignSectionTmp;};
	
};


//Smith-Waterman Alignment
class SmithWaterman : public Alignment
{
public:
	//Constructor
	SmithWaterman(ColumnComp* c, double gO = DFLT_GAP_OPEN, double gE = DFLT_GAP_EXTEND, bool overlap=false, bool extend=false):Alignment(c, gO, gE, overlap, extend){}

	//Alignment implementation
	double AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward);

	//Destructor
	~SmithWaterman(){}
};

//Smith-Waterman Alignment with affine gap cost
class SmithWatermanAffine : public Alignment
{
public:
	//Constructor
	SmithWatermanAffine(ColumnComp* c, double gO = DFLT_GAP_OPEN, double gE = DFLT_GAP_EXTEND, bool overlap=false, bool extend=false):Alignment(c, gO, gE, overlap, extend){}

	//Alignment implementation
	double AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward);

	//Destructor
	~SmithWatermanAffine(){}
};

//Smith-Waterman Alignment with affine gap cost
class NeedlemanWunsch : public Alignment
{
public:
	//Constructor
	NeedlemanWunsch(ColumnComp* c, double gO = DFLT_GAP_OPEN, double gE = DFLT_GAP_EXTEND, bool overlap=true, bool extend=false):Alignment(c, gO, gE, true, false){}

	//Alignment implementation
	double AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward);

	//Destructor
	~NeedlemanWunsch(){}
};

//Smith-Waterman Alignment with affine gap cost
class SmithWatermanUngappedExtended : public Alignment
{
public:
	//Constructor
	SmithWatermanUngappedExtended(ColumnComp* c):Alignment(c, 0, 0, false, true){}

	//Alignment implementation
	double AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward);

	//Destructor
	~SmithWatermanUngappedExtended(){}
};
#endif
