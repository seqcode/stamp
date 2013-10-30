//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// main.cpp
//
// Started: 5th Nov 2005
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


#ifndef PSSM_MARK
#define PSSM_MARK
#include "globals.h"

const double CONS1 = 0.6;
const double CONS2 = 0.8;

class PSSM {
public:
	double **matrix;
	int len;
	char name[STR_LEN];

	//Constructor
	PSSM(int l=0);

	//Reverse-complement a PSSM
	void RevCompPSSM(PSSM* out);
	
	//Consensus letter for a column
	char ColConsensus(int i);
	
	//Destructor
	~PSSM();
};

#endif

