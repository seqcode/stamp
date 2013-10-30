//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// RandPSSMGen.cpp
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

#include "RandPSSMGen.h"


//Run the generator
void RandPSSMGen::RunGenerator()
{
	int c, i, j, k,l,m,q,w,z, curr_len;
	double curr_depth;
	double x, r;
	int zeros=0;
	double col_sum=0;
	double firstDraw, secondDraw, thirdDraw, sum;
	gsl_histogram* width_hist;
	gsl_histogram_pdf* width_pdf;
	gsl_histogram* depth_hist;
	gsl_histogram_pdf* depth_pdf;
	double invariant_cols[6];
	double total_cols[6];
	double invariant_prob[6];
	double abszero_cells[6];
	double total_cells[6];
	double abszero_prob[6];
	gsl_histogram* first_edge_hist;
	gsl_histogram_pdf* first_edge_pdf;
	gsl_histogram* first_inner_hist;
	gsl_histogram_pdf* first_inner_pdf;
	gsl_histogram* second_edge_hist[5];
	gsl_histogram_pdf* second_edge_pdf[5];
	gsl_histogram* second_inner_hist[5];
	gsl_histogram_pdf* second_inner_pdf[5];
	gsl_histogram* third_edge_hist[5];
	gsl_histogram_pdf* third_edge_pdf[5];
	gsl_histogram* third_inner_hist[5];
	gsl_histogram_pdf* third_inner_pdf[5];
	FILE* out;
	bool edge;
	double known_zeros=0, known_total=0;
	double new_zeros=0, new_total=0;

	out = fopen(outFN, "w");
	if(out==NULL)
	{	printf("Error: cannot open file named %s\n", outFN);
		exit(1);
	}

	//How many random matrices?
	printf("%d Matrices Will Be Generated\n", numRandomMats);

	//Read in the matrices
	printf("%d Matrices Read In\n", numMatrices);
	
	//1) The first step is to read in the width distribution
	width_hist = gsl_histogram_alloc(7); //7 places in the histogram
	double width_range[8] = {3, 5, 8, 10, 12, 14, 16, 25};
	gsl_histogram_set_ranges(width_hist, width_range, 8);
	for(i=0; i<numMatrices; i++) {//Go through each matrix, adding size to histogram
		gsl_histogram_increment(width_hist, (double)matrices[i]->len);
	}
	width_pdf= gsl_histogram_pdf_alloc(7);
	gsl_histogram_pdf_init(width_pdf, width_hist);
	//1.1) Find the sequence depth distribution
	depth_hist = gsl_histogram_alloc(7); //20 places in the histogram
	double depth_range[8] = {0,5,10,20,40,80,160,1000};
	gsl_histogram_set_ranges(depth_hist, depth_range, 8);
	for(i=0; i<numMatrices; i++) {//Go through each matrix, adding each column depth to histogram
		for(j=0; j<matrices[i]->len; j++){
			double sum=0;	
			for(k=0; k<B; k++){
				sum += matrices[i]->n[j][k];
			}
            gsl_histogram_increment(depth_hist, sum);
		}
	}
	depth_pdf = gsl_histogram_pdf_alloc(7);
	gsl_histogram_pdf_init(depth_pdf, depth_hist);


	//2) The second step is to find the probability of invariance given the position of the column
	//Also find the probability of an absolute zero (not including the invariant columns)
	for(i=0; i<6; i++) {
		invariant_cols[i]=0;
		total_cols[i]=0;
		abszero_cells[i]=0;
		total_cells[i]=0;
	}
	bool inv=false;
	for(i=0; i<numMatrices; i++) {
		curr_len = matrices[i]->len;
		for(j=0; j<curr_len; j++){
			//Is the column invariant?
			inv = Invariant(matrices[i]->n[j], zeros);
			//What column are we in?
			z = WhatColumn(j, curr_len);
			total_cols[z]++;
			invariant_cols[z]+=inv;

			//Find zeros in a variable column
			if(!inv) {
				total_cells[z]+=4;
				abszero_cells[z]+=zeros;
			}
			known_total+=4; known_zeros+=zeros;
		}
	}
	for(i=0; i<6; i++){
		invariant_prob[i]=invariant_cols[i]/total_cols[i];
		abszero_prob[i]=abszero_cells[i]/total_cells[i];
	}
	printf("Known Zeros: %lf\n", known_zeros/known_total);
	//3) Fill the First, Second, and Third Draw Histograms.
	first_edge_hist = gsl_histogram_alloc(5);
	gsl_histogram_set_ranges_uniform (first_edge_hist, 0.0001, 0.99999);
	first_inner_hist = gsl_histogram_alloc(5);
	gsl_histogram_set_ranges_uniform (first_inner_hist, 0.0001, 0.99999);
	for(i=0; i<5; i++){
		second_edge_hist[i] = gsl_histogram_alloc(5);
		gsl_histogram_set_ranges_uniform(second_edge_hist[i], 0.0001, 0.99999);
		second_inner_hist[i] = gsl_histogram_alloc(5);
		gsl_histogram_set_ranges_uniform(second_inner_hist[i], 0.0001, 0.99999);
	}
	for(i=0; i<5; i++){
		third_edge_hist[i] = gsl_histogram_alloc(5);
		gsl_histogram_set_ranges_uniform(third_edge_hist[i], 0.0001, 0.99999);
		third_inner_hist[i] = gsl_histogram_alloc(5);
		gsl_histogram_set_ranges_uniform(third_inner_hist[i], 0.0001, 0.99999);
	}
	
	for(i=0; i<numMatrices; i++) {
		curr_len = matrices[i]->len;
		for(j=0; j<curr_len; j++){
			if(WhatColumn(j, curr_len)==0)
				edge=true;
			else
				edge=false;
			//Discard Invariant Columns
			if(!Invariant(matrices[i]->n[j], zeros)) {
				col_sum = SumColumn(matrices[i]->n[j]);
				for(k=0; k<B; k++) {
					//Update first draw distribution
					firstDraw =matrices[i]->n[j][k];
					if(firstDraw!=0){//Discard Zeros
						if(edge)
							gsl_histogram_increment(first_edge_hist, firstDraw/col_sum);
						else
							gsl_histogram_increment(first_inner_hist, firstDraw/col_sum);
					}

					//Update second draw distribution
					for(l=0; l<B; l++){
						if(l!=k) {
							secondDraw = matrices[i]->n[j][l];
							if(secondDraw!=0) {
								if(edge)
									gsl_histogram_increment(second_edge_hist[(int)floor((firstDraw/col_sum)*5)], secondDraw/col_sum);
								else
									gsl_histogram_increment(second_inner_hist[(int)floor((firstDraw/col_sum)*5)], secondDraw/col_sum);
							}
							sum = secondDraw + firstDraw;
							//Update third draw distribution
							for(m=0; m<B; m++){
								if(m!=k && m!=l) {
									thirdDraw = matrices[i]->n[j][m];
									if(thirdDraw!=0) {
										if(edge)
											gsl_histogram_increment(third_edge_hist[(int)floor((sum/col_sum)*5)], thirdDraw/col_sum);
										else
											gsl_histogram_increment(third_inner_hist[(int)floor((sum/col_sum)*5)], thirdDraw/col_sum);
									}
								}
							}
						}
					}
				}
			}
		}
	}
	//Start the PDFs here
	first_edge_pdf= gsl_histogram_pdf_alloc(5);
	gsl_histogram_pdf_init(first_edge_pdf, first_edge_hist);
	first_inner_pdf= gsl_histogram_pdf_alloc(5);
	gsl_histogram_pdf_init(first_inner_pdf, first_inner_hist);
	for(i=0; i<5; i++) {
		second_edge_pdf[i]= gsl_histogram_pdf_alloc(5);
		gsl_histogram_pdf_init(second_edge_pdf[i], second_edge_hist[i]);
		second_inner_pdf[i]= gsl_histogram_pdf_alloc(5);
		gsl_histogram_pdf_init(second_inner_pdf[i], second_inner_hist[i]);
	}
	for(i=0; i<5; i++) {
		third_edge_pdf[i]= gsl_histogram_pdf_alloc(5);
		gsl_histogram_pdf_init(third_edge_pdf[i], third_edge_hist[i]);
		third_inner_pdf[i]= gsl_histogram_pdf_alloc(5);
		gsl_histogram_pdf_init(third_inner_pdf[i], third_inner_hist[i]);
	}


	////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////// All information gathered... generating random samples from here on in /////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////////
	Motif* newPSSM = new Motif(31);
	for(z=0; z<numRandomMats; z++) {
		double r;
		int base;
		int first, second, third, fourth;
		//first step: pick a length
		r=((double)rand())/RAND_MAX;
		curr_len = (int)gsl_histogram_pdf_sample(width_pdf, r);
		if(curr_len>30){curr_len=30;}

		for(i=0; i<curr_len; i++) { //Generate one column at a time
			//Reset the column
			for(j=0; j<B; j++)
				newPSSM->f[i][j]=0;

			if(WhatColumn(i, curr_len)==0)
				edge=true;
			else
				edge=false;
			//Is the column variable? 
			r=((double)rand())/RAND_MAX;
			c = WhatColumn(i, curr_len);
			if(r<invariant_prob[c]) { //The column has been chosen as invariant
				//Which base is invariant? 
				r = ((double)rand())/RAND_MAX;
				if(r<0.285){base=0;}
				else if(r<0.57){base=3;}
				else if(r<0.785){base=1;}
				else{base=2;}

				newPSSM->f[i][base]=1;
				for(j=0; j<B; j++) {
					if(j!=base)
						newPSSM->f[i][j]=0;
				}
			}else{//the column has been chosen as variable
				sum=0;
				//Which base will be the focus of the first draw?
				first = rand()%B;
				//Is the first draw an absolute zero?
				r=((double)rand())/RAND_MAX;
				if(r<abszero_prob[WhatColumn(i, curr_len)]){//the cell is zero
					newPSSM->f[i][first]=0;
				}else{//the cell isn't zero
					//Sample from the first cell pdf
					r=((double)rand())/RAND_MAX;
					if(edge)
						newPSSM->f[i][first] = gsl_histogram_pdf_sample(first_edge_pdf, r);
					else
						newPSSM->f[i][first] = gsl_histogram_pdf_sample(first_inner_pdf, r);
				}
				sum+=newPSSM->f[i][first];
				//Onto the second draw
				second=rand()%B;
				while(second==first)
				{	second=rand()%B;}

				r=((double)rand())/RAND_MAX;
				if(r<abszero_prob[WhatColumn(i, curr_len)]){//the cell is zero
					newPSSM->f[i][second]=0;
				}else{//the cell isn't zero
					//Sample from the first cell pdf
					r=((double)rand())/RAND_MAX;
					if(edge)
						newPSSM->f[i][second] = gsl_histogram_pdf_sample(second_edge_pdf[(int)floor((sum)*5)], r);
					else
						newPSSM->f[i][second] = gsl_histogram_pdf_sample(second_inner_pdf[(int)floor((sum)*5)], r);
				}
				sum+=newPSSM->f[i][second];
				//NORMALIZING! Check if anything is over 1 at this stage!
				if(sum>1)
				{	newPSSM->f[i][first] = newPSSM->f[i][first]/sum;
					newPSSM->f[i][second] = newPSSM->f[i][second]/sum;
					sum=1;
				}else{
					//Deal with the third draw here
					third=rand()%B;
					while(third==first || third==second)
					{	third=rand()%B;}

					r=((double)rand())/RAND_MAX;
					if(r<abszero_prob[WhatColumn(i, curr_len)]){//the cell is zero
						newPSSM->f[i][third]=0;
					}else{//the cell isn't zero
						//Sample from the first cell pdf
						r=((double)rand())/RAND_MAX;
						if(edge)
							newPSSM->f[i][third] = gsl_histogram_pdf_sample(third_edge_pdf[(int)floor((sum)*5)], r);
						else
							newPSSM->f[i][third] = gsl_histogram_pdf_sample(third_inner_pdf[(int)floor((sum)*5)], r);
					}
					sum+=newPSSM->f[i][third];
					//NORMALIZING! Check if anything is over 1 at this stage!
					if(sum>1)
					{	newPSSM->f[i][first] = newPSSM->f[i][first]/sum;
						newPSSM->f[i][second] = newPSSM->f[i][second]/sum;
						newPSSM->f[i][third] = newPSSM->f[i][third]/sum;
						sum=1;
					}else{
						//Deal with the last base here
						fourth=0;
						while(fourth==first||fourth==second||fourth==third)
							fourth++;
						newPSSM->f[i][fourth]=1-sum;
					}
				}
			}	
			Invariant(newPSSM->f[i], zeros);
			new_total+=4; new_zeros+=zeros;
		}
		//PSSM Generated!

		//Convert to n's
		r=((double)rand())/RAND_MAX;
		curr_depth = gsl_histogram_pdf_sample(depth_pdf, r);
		if(curr_depth<5){curr_len=5;}
		for(q=0; q<curr_len; q++){
			for(w=0; w<B; w++){
				newPSSM->n[q][w] = ceil(newPSSM->f[q][w]*curr_depth);
			}
		}

		//Output in TRANSFAC format
		fprintf(out, "DE\tRAND%d\n", z);
		for(q=0; q<curr_len; q++){
			fprintf(out, "%d\t%lf\t%lf\t%lf\t%lf\tX\n", q, newPSSM->n[q][0],newPSSM->n[q][1],newPSSM->n[q][2],newPSSM->n[q][3]);
		}
		fprintf(out, "XX\n");
	}
printf("New Zeros: %lf\n", new_zeros/new_total);
	/////////////////// Memory cleaning area ///////////////////////////////////////////////////////////////////
	delete newPSSM;
	gsl_histogram_free(width_hist);
	gsl_histogram_pdf_free(width_pdf);
	gsl_histogram_free(first_edge_hist);
	gsl_histogram_pdf_free(first_edge_pdf);
	gsl_histogram_free(first_inner_hist);
	gsl_histogram_pdf_free(first_inner_pdf);
	for(i=0; i<5; i++) {
		gsl_histogram_free(second_edge_hist[i]);
		gsl_histogram_pdf_free(second_edge_pdf[i]);
		gsl_histogram_free(second_inner_hist[i]);
		gsl_histogram_pdf_free(second_inner_pdf[i]);
	}
	for(i=0; i<5; i++) {
		gsl_histogram_free(third_edge_hist[i]);
		gsl_histogram_pdf_free(third_edge_pdf[i]);
		gsl_histogram_free(third_inner_hist[i]);
		gsl_histogram_pdf_free(third_inner_pdf[i]);
	}
	fclose(out);		

}

bool RandPSSMGen::Invariant(double* col, int& zeros)
{
	int zero_cnt=0;
	for(int i=0; i<B; i++)
	{	if(col[i]==0)
			zero_cnt++;
	}
	zeros = zero_cnt;
	if(zero_cnt==3)
		return true;
	else
		return false;
}

int RandPSSMGen::WhatColumn(int i, int len)
{
	//0 = e0, 1=e1, 2=e2, 3=m2, 4=m1, 5=m0 (middle)
	if(i==0 || i==len-1) 
		return(0);
	else if(i==1||i==len-2)
		return(1);
	else if(i==2||i==len-3)
		return(2);
	else if(i==3||i==len-4)
		return(3);
	else if(i==4||i==len-5)
		return(4);
	else
		return(5);
}

double RandPSSMGen::SumColumn(double* col)
{
	double s=0;
	for(int i=0; i<B; i++)
	{	
		s+=col[i];
	}
	return(s);
}

