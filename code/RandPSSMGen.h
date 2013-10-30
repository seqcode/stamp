//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// main.cpp
//
// Started: 5th Dec 2005
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

#ifndef RANDPSSM_MARK
#define RANDPSSM_MARK

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "Motif.h"
#include "globals.h"
#include <gsl/gsl_histogram.h>

class RandPSSMGen{
private:
	int numRandomMats;
	int numMatrices;
	char outFN[STR_LEN];
	Motif** matrices;

public:
	RandPSSMGen(Motif** baseMats, int n_mat, int n_rand, char* outFilename){matrices = baseMats; numMatrices = n_mat, numRandomMats=n_rand; strcpy(outFN, outFilename);}

	//Run generator
	void RunGenerator();

    //Associate methods
	bool Invariant(double* col, int& zeros);
	int WhatColumn(int i, int len);
	double SumColumn(double* col);
};

#endif
