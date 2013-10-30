//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1
//
// Written By: Shaun Mahony
//
// MultipleAlignment.h
//
// Started: 16th January 2006
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

#ifndef MA_MARK
#define MA_MARK

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "globals.h"
#include "Motif.h"
#include "Alignment.h"
#include "Tree.h"
#include "PlatformSupport.h"


//General multiple alignment class
class MultipleAlignment{
protected:
	PlatformSupport* Plat;
	Tree* T;
	Alignment* A_man;
	MultiAlignRec* completeAlignment;
	bool htmlOutput;
	char outName[STR_LEN];

public:
	//Constructor
	MultipleAlignment(char* outRoot, bool html){completeAlignment=NULL; htmlOutput = html; strcpy(outName, outRoot);}

	//Virtual building method
	virtual MultiAlignRec* BuildAlignment(PlatformSupport* p, Alignment* a, Tree* curr_tree=NULL)=0;

	//Import the platform handler (mainly used by the neural trees)
	void ImportBasics(PlatformSupport* p, Alignment* a){Plat = p; A_man=a;}

	//Handle pre-aligned profiles
	MultiAlignRec* PreAlignedInput(PlatformSupport* p);

	//Convert an alignment to a profile
	Motif* Alignment2Profile(MultiAlignRec* alignment, char* name);
	//Convert a multiple alignment to a Sandelin & Wasserman FBP
	Motif* Alignment2SWFBP(MultiAlignRec* alignment, char* name);

	//Print the alignment
	void PrintMultipleAlignmentConsensus(MultiAlignRec* alignment=NULL);

	//Align a profile to an existing alignment and return the new alignment
	MultiAlignRec* SingleProfileAddition(MultiAlignRec* alignment, Motif* two, int twoID);
	//Remove a profile from an existing alignment and return the new alignment
	MultiAlignRec* SingleProfileSubtraction(MultiAlignRec* alignment, int removeID);

	//Convert the profile to a weighted FBP
	void WeightedFBP(MultiAlignRec* alignment, Motif* currProfile);

	//Destructor
	~MultipleAlignment(){if(completeAlignment!=NULL){delete completeAlignment;}}
};


//Progressive profile alignment
class ProgressiveProfileAlignment : public MultipleAlignment{
private:
	//Traverse the tree to build the alignment
	void PostorderAlignment(TreeNode* n, TreeNode* start);

public:
	//Constructor
	ProgressiveProfileAlignment(char* outRoot, bool html=false):MultipleAlignment(outRoot, html){};

	//Build the multiple alignment
	MultiAlignRec* BuildAlignment(PlatformSupport* p, Alignment* a, Tree* curr_tree);

};

//Iterative refinement profile alignment
class IterativeRefinementAlignment : public MultipleAlignment{

public:
	//Constructor
	IterativeRefinementAlignment(char* outRoot, bool html=false):MultipleAlignment(outRoot, html){};

	//Build the multiple alignment
	MultiAlignRec* BuildAlignment(PlatformSupport* p, Alignment* a, Tree* curr_tree=NULL);

};

#endif

