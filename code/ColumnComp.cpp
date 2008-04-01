//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// ColumnComp.cpp
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


#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "ColumnComp.h"
#include "globals.h"
#include <gsl/gsl_randist.h>
#include <gsl/gsl_cdf.h>

//Pearson's correllation coefficient
double PearsonCorrelation::Compare(Motif* M_A, int colA, Motif* M_B, int colB)
{
	int i;
	double num=0, denom=0;
	double diff1, diff2;
	double sum_diff1_sq=0, sum_diff2_sq=0;
	double score=0;
	double mean1=0, mean2=0;
	
	//Calc means
	for(i=0; i<B; i++) {
		mean1+=M_A->f[colA][i];
		mean2+=M_B->f[colB][i];
	}
	mean1=mean1/(double)B;
	mean2=mean2/(double)B;

	//Error check
	if(mean1==0 || mean2==0)
		return(min);
	else{

		//Calc the num and denom
		for(i=0; i<B; i++) {
			diff1 = M_A->f[colA][i]-mean1;
			diff2 = M_B->f[colB][i]-mean2;

			num += diff1*diff2;
			
			sum_diff1_sq += (diff1*diff1);
			sum_diff2_sq += (diff2*diff2);
		}
		if(num!=0)
			score = num / (sqrt(sum_diff1_sq * sum_diff2_sq));
		else
			score = 0;
		return(score);
	}
}

//ALLR compare
double ALLR::Compare(Motif* M_A, int colA, Motif* M_B, int colB)
{
	int i;
	double LLR1=0, LLR2=0, denom=0, res;

	for(i=0; i<B; i++){
		denom += (M_A->n[colA][i]+M_B->n[colB][i]);
		LLR1 += (M_B->n[colB][i] * M_A->pwm[colA][i]);
		LLR2 += (M_A->n[colA][i] * M_B->pwm[colB][i]);
	}
	
	if(denom==0)
		return(min);
	else{
		return((LLR1+LLR2)/denom);
	}
}
//ALLR with lower limit compare
double ALLR_LL::Compare(Motif* M_A, int colA, Motif* M_B, int colB)
{
	int i;
	double LLR1=0, LLR2=0, denom=0, res;

	for(i=0; i<B; i++){
		denom += (M_A->n[colA][i]+M_B->n[colB][i]);
		LLR1 += (M_B->n[colB][i] * M_A->pwm[colA][i]);
		LLR2 += (M_A->n[colA][i] * M_B->pwm[colB][i]);
	}
	
	if(denom==0)
		return(min);
	else{
		res = (LLR1+LLR2)/denom;
		if(res<min)
			res=min;
		return(res);
	}
}

//Chi-square compare
//!!!!!!! only for columns with site depth > 5... adds one to every column!
double ChiSq::Compare(Motif* M_A, int colA, Motif* M_B, int colB)
{
	int i;
	double CS1=0, CS2=0;
	double x,f_x;
	double exp1, exp2;
	double N1=0, N2=0;
	for(i=0; i<B; i++){
		N1+=M_A->n[colA][i];
		N2+=M_B->n[colB][i];
	}
	for(i=0; i<B; i++){
		exp1 = ((N1+4)*(M_A->n[colA][i]+1+M_B->n[colB][i]+1))/(N1+N2+8);
		exp2 = ((N2+4)*(M_A->n[colA][i]+1+M_B->n[colB][i]+1))/(N1+N2+8);
		CS1+=((M_A->n[colA][i]+1-exp1)*(M_A->n[colA][i]+1-exp1))/exp1;
		CS2+=((M_B->n[colB][i]+1-exp2)*(M_B->n[colB][i]+1-exp2))/exp2;
	}
	x = (CS1+CS2);
	
	return(1-gsl_cdf_chisq_P(x, 3));
}

//Sum of squared differences compare
double SumSqDiff::Compare(Motif* M_A, int colA, Motif* M_B, int colB)
{
	int i;
	double roll_sum=0;

	for(i=0; i<B; i++){
		roll_sum += (M_A->f[colA][i]-M_B->f[colB][i])*(M_A->f[colA][i]-M_B->f[colB][i]);
	}
	return(2-roll_sum); //Score goes from 0 (min) to 2 (max)
}

//Kullback-Lieber Compare
double KullbackLieber::Compare(Motif* M_A, int colA, Motif* M_B, int colB)
{
	int i;
	double KL1=0, KL2=0;
	
	for(i=0; i<B; i++){
		if(M_A->f[colA][i]==0 || M_B->f[colB][i]==0){}
		else{
			KL1 += M_A->f[colA][i] * (log(M_A->f[colA][i]/M_B->f[colB][i]));
			KL2	+= M_B->f[colB][i] * (log(M_B->f[colB][i]/M_A->f[colA][i]));
		}
	}
	return(10-((KL1+KL2)/2)); //Score goes from LESS THAN 0 (min) to 10 (max). 10 is arbitrary here.
}
