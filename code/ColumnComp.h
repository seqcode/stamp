//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// ColumnComp.h
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


#ifndef COLUMN_MARK
#define COLUMN_MARK
#include <math.h>
#include "globals.h"
#include "Motif.h"

class ColumnComp{
protected: 
	double max;
	double min;
	double expected;

public:
	//Constructor
	ColumnComp(){}

	//Accessors
	double GetMax(){return max;}
	double GetMin(){return min;}
	
	//Actual comparison method
	virtual double Compare(Motif* M_A, int colA, Motif* M_B, int colB)=0;
};

//Pearson Correlation Coefficient
class PearsonCorrelation : public ColumnComp
{
public:
	//Constructor
	PearsonCorrelation():ColumnComp(){max=1.0; min=-1.0; expected=0;};

	//Pearson compare
	double Compare(Motif* M_A, int colA, Motif* M_B, int colB);
};

//Wang & Stormo's Average Log Likelihood Ratio
class ALLR : public ColumnComp
{
public:
	//Constructor
	ALLR():ColumnComp(){max=2; min=-15; expected=0; /*max, min & expected unknown*/};
	
	//ALLR compare
	double Compare(Motif* M_A, int colA, Motif* M_B, int colB);
};

//Wang & Stormo's Average Log Likelihood Ratio with a lower limit
class ALLR_LL : public ColumnComp
{
public:
	//Constructor
	ALLR_LL():ColumnComp(){max=2; min=-2; expected=0; /*max, min & expected unknown*/};
	
	//ALLR compare
	double Compare(Motif* M_A, int colA, Motif* M_B, int colB);
};

//Pearson's Chi-squared 
class ChiSq : public ColumnComp
{
public:
	//Constructor
	ChiSq():ColumnComp(){max=1; min=0; expected=0; /*max, min & expected unknown*/};
	
	//ALLR compare
	double Compare(Motif* M_A, int colA, Motif* M_B, int colB);
};


//Sum of squared differences
class SumSqDiff : public ColumnComp
{
public:
	//Constructor
	SumSqDiff():ColumnComp(){max=2; min=0; expected=0; /*max, min & expected unknown*/};
	
	//ALLR compare
	double Compare(Motif* M_A, int colA, Motif* M_B, int colB);
};

//Kullback-Lieber (Averaged & K-L for whole alignment should be divided by L)
class KullbackLieber : public ColumnComp
{
public:
	//Constructor
	KullbackLieber():ColumnComp(){max=12; min=0; expected=0; /*max, min & expected unknown*/};
	
	//ALLR compare
	double Compare(Motif* M_A, int colA, Motif* M_B, int colB);
};

#endif
