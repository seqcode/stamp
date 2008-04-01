//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// Motif.h
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


#ifndef Motif_MARK
#define Motif_MARK
#include "globals.h"
#include <stdio.h>
#include <stdlib.h>

const double CONS1 = 0.6;
const double CONS2 = 0.8;
const double CONS3 = 0.99;

class Motif {
public:
	int len;
	double **f;
	double **n;
	double **pwm;
	double *gaps;
	double members;
	char name[STR_LEN];
	double weighting; //Only used to provide weighting for motifs in an FBP.
	char famName[STR_LEN]; //Only used in testing!

	//Constructor
	Motif(int l=0);

	//Accessors
	int GetLen(){return len;}
	char* GetName(){return name;}

	//Reverse-complement the motif
	void RevCompMotif(Motif* out);

	//Reverse complement a single column
	void RevCompColumn(int i);

	//Copy a motif
	void CopyMotif(Motif* out);
	
	//Consensus letter for a column (taken from f)
	char ColConsensus(int i);
    
	//Find the information content of a column in f
	double Info(int i);

	//Print the motif in TRANSFAC format
	void PrintMotif(FILE* out=NULL, bool famNames=false);

	//Print the motif's consensus
	void PrintMotifConsensus();
	
	//log base 2
	double log_2(double x){ return(log(x) / LOG_2);}

	//Reset method
	void Reset();

	//Destructor
	~Motif();
};

#endif

