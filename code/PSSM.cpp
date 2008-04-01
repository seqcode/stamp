//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// PSSM.cpp
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

#include <string.h>
#include "PSSM.h"
#include "globals.h"

PSSM::PSSM(int l)
{
	int i,j;
	len=l;
	matrix = new double* [l];
	for(i=0; i<l; i++)
	{	matrix[i] = new double[B];
		for(j=0; j<B; j++)
			matrix[i][j]=0;
	}
}

void PSSM::RevCompPSSM(PSSM* out)
{
	out->len = len;
	strcpy(out->name, name);
	
	for(int i=0; i<len; i++)
	{
		out->matrix[(len-i)-1][0] = matrix[i][3];
		out->matrix[(len-i)-1][3] = matrix[i][0];
		out->matrix[(len-i)-1][1] = matrix[i][2];
		out->matrix[(len-i)-1][2] = matrix[i][1];
	}
}

char PSSM::ColConsensus(int i)
{
	char val;
	char curr;
	//char two_base_l[6]; //two base consensus
	//double two_base_c[6];
	double sum, p_max;
	int j, k;

	//Hard-coded
/*	two_base_l[0]='Y';
	two_base_l[1]='R';
	two_base_l[2]='W';
	two_base_l[3]='S';
	two_base_l[4]='K';
	two_base_l[5]='M';

	
	two_base_c[0]=x.probMatrix[i][1]+x.probMatrix[i][3];
	two_base_c[1]=x.probMatrix[i][0]+x.probMatrix[i][2];
	two_base_c[2]=x.probMatrix[i][0]+x.probMatrix[i][3];
	two_base_c[3]=x.probMatrix[i][1]+x.probMatrix[i][2];
	two_base_c[4]=x.probMatrix[i][2]+x.probMatrix[i][3];
	two_base_c[5]=x.probMatrix[i][0]+x.probMatrix[i][1];
*/	
	sum=0;
	for(j=0; j<4; j++)
		sum+=matrix[i][j];

	
	if(matrix[i][0]/sum>=CONS1) {curr='A';}
	else if(matrix[i][1]/sum>=CONS1) {curr='C';}
	else if(matrix[i][2]/sum>=CONS1) {curr='G';}
	else if(matrix[i][3]/sum>=CONS1) {curr='T';}
	else {
		curr='N';
	}

	return(curr);
}

PSSM::~PSSM()
{
	int i;
	for(i=0; i<len; i++)
	{
		delete [] matrix[i];
	}
	delete [] matrix;
}

