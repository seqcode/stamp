//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// PlatformTesting.h
//
// Started: 18th Nov 2005
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


#ifndef TEST_MARK
#define TEST_MARK

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "globals.h"
#include "Motif.h"
#include "Alignment.h"
#include "PlatformSupport.h"


//Testing class that contains classes without general applicability
class PlatformTesting
{
private:
	ColumnComp* Metric;

public:
	//Constructor
	PlatformTesting(ColumnComp* c){Metric = c;}

	//Create random columns for a given information content
	void RandColumns(PlatformSupport* PS, double infoContent);

	//Distribution of all column scores
	void ColumnScoreDist(Motif** motifSet, int numMotifs, double interval);

	//Distribution of all column instance depths
	void ColumnDepthDist(Motif** motifSet, int numMotifs);

	//Test pairwise accuracy
	void PairwisePredictionAccuracy(PlatformSupport* PS);
};

#endif 
