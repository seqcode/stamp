//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// main.cpp
//
// Started: 4th Feb 2006
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


#ifndef PROTEIN_MARK
#define PROTEIN_MARK


//Includes
#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include<ctype.h>
#include "globals.h"
#include "Motif.h"
#include "Alignment.h"

class ProteinMotif
{
private:
	int len;
    
public:
	char name[STR_LEN];
	double** f;

	//Constructor
	ProteinMotif(int l);

	//Accessor
	int GetLen(){return len;}

	//Print the motif
	void PrintMotif();

	//the information content of a column
	double Info(int col);
	//log base 2
	double log_2(double x){ return(log(x) / LOG_2);}

	//Destructor
    ~ProteinMotif();
};

//Protein Domain Handler
class ProteinDomains
{
private:
	int numDomains;
	char inputFN[STR_LEN];
	
public:
	//The overall and single motifs
	ProteinMotif* domainMotif;
	ProteinMotif** individualMotifs;

	//Constructor
	ProteinDomains(){numDomains=0; domainMotif=NULL; individualMotifs=NULL;}

	//Read in the motifs
	void ReadDomains(char* inFileName, Motif** inputMotifs, int numMotifs);

	//Do the mutual information analysis
	void MutualInformation(MultiAlignRec* pssmAlignment, Motif* alignmentMotif, Motif** inputMotifs, int numMotifs);
		
	//Convert an amino acid to a number
	int char2num(char x);
	//log base 2
	double log_2(double x){ return(log(x) / LOG_2);}

	//Destructor
	~ProteinDomains();
};

#endif
