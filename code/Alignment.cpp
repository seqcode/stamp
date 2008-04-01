//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// Alignment.cpp
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


#include "Alignment.h"

//AlignRec Constructor
AlignRec::AlignRec(int nA, int aL)
{
	int i;
	numAligned=nA;
	alignL=aL;
	alignedNames = new char*[numAligned];
	alignedIDs = new int [numAligned];
	for(i=0; i<numAligned; i++)
		alignedNames[i] = new char[STR_LEN];
	if(alignL==0)
		alignSection=NULL; 
	else{
        alignSection = new int*[numAligned];
		for(i=0; i<numAligned; i++){
			alignSection[i]=new int [alignL];
		}
	}
}

//Copy the alignment section
void AlignRec::CopyAlignSec(int** AS, int aL, int nA)
{
	int i;
	if(alignSection!=NULL){
		for(i=0; i<numAligned; i++){
			delete [] alignSection[i];
		}
		delete [] alignSection;
	}
	alignL=aL;
	numAligned=nA;
	alignSection = new int*[numAligned];
	for(i=0; i<numAligned; i++){
		alignSection[i]=new int [alignL];
	}
	for(i=0; i<numAligned; i++){
		for(int z=0; z<alignL; z++){
			alignSection[i][z]=AS[i][z];
		}
	}
}

//MultiAlignRec Constructor
MultiAlignRec::MultiAlignRec(int nA, int aL)
{
	int i, j, k;
	numAligned=nA;
	alignL=aL;
	alignedNames = new char*[numAligned];
	alignedIDs = new int [numAligned];
	for(i=0; i<numAligned; i++)
		alignedNames[i] = new char[STR_LEN];
	profileAlignment = new Motif*[numAligned];
	for(i=0; i<numAligned; i++){
		profileAlignment[i]=new Motif(alignL);
	}
}

//Alignment constructor;
Alignment::Alignment(ColumnComp* c, double gO, double gE, bool overlap, bool extend)
{
	gapOpen = gO; 
	gapExtend = gE; 
    Metric = c; 
	this->overlapOnly =  overlap;
	extendOverlap=extend;
	alignLen=0; 
    alignSection = new int*[2];
	alignSectionTmp = new int*[2];
	for(int i=0; i<2; i++)
	{alignSection[i]=new int [MAX_MOTIF_LEN*2];
	 alignSectionTmp[i]=new int [MAX_MOTIF_LEN*2];}
}
//***Warning*** This method only works when the correct motif directions are provided
//Copy the current alignment to the given strings
void Alignment::CopyAlignmentConsensus(Motif* one, Motif* two, char* str_one, char* str_two)
{
	int z, c;
	int last, last2;
	Motif* currMotif;
	char* currStr;

	if(alignLen>0){
		for(int q=0; q<2; q++){
			if(q==0){currMotif=one;currStr=str_one;}
			else{currMotif=two;currStr=str_two;}
			
			c=0;
			last=-50;
			for(z=alignLen-1; z>=0; z--){

				if(alignSection[q][z]==last || alignSection[q][z]==-1)
					currStr[c]='-';
				else
					currStr[c]= currMotif->ColConsensus(alignSection[q][z]);
				
				last = alignSection[q][z];
				c++;
			}
			currStr[c]='\0';
		}
	}else{
		strcpy(str_one, "");strcpy(str_two, "");
	}
}

//***Warning*** This method only works when the correct motif directions are provided
//Print the current alignment section
void Alignment::PrintAlignmentConsensus(Motif* one, Motif* two)
{
	int z; 
	int last, last2;
	Motif* currMotif;

	if(alignLen>0){
		printf("\n\n%d, %lf\n", alignLen, alignScore);
		//if(alignForward){printf("F\n");}
		for(int q=0; q<2; q++){
			if(q==0){currMotif=one;}
			else{currMotif=two;}


			printf("\t%s:\t", currMotif->name);
	//		last = alignSection[q][alignLen-1];
			last=-50;
			for(z=alignLen-1; z>=0; z--){

				if(alignSection[q][z]==last || alignSection[q][z]==-1)
					printf("-");
				else
					printf("%c", currMotif->ColConsensus(alignSection[q][z]));
				
				last = alignSection[q][z];
			}
			printf("\n");
		}
		printf("\n");
	}
}

//Do two sweeps of the alignment method and return the best results. 
double Alignment::AlignMotifs2D(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward1, bool& forward2)
{
	double score1, score2, bestScore=0;
	int i1_A, i2_A, i1_B, i2_B;
	int aL_A, aL_B; 
	bool for_A, for_B;
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* revTwo = new Motif(two->GetLen());
	two->RevCompMotif(revTwo);
	Motif* currOne = one;
	Motif* currTwo = two;
    
	//Send both motifs in forward direction (takes care of both forward and "one" reversed)
	score1 = AlignMotifs(one, two, i1_A, i2_A, aL_A, for_A);
	for(int i=0; i<aL_A; i++){
		alignSectionTmp[0][i] = alignSection[0][i];
		alignSectionTmp[1][i] = alignSection[1][i];
	}
	//Send both motifs in reverse direction (takes care of both reversed and "two" reversed)
	score2 = AlignMotifs(revOne, revTwo, i1_B, i2_B, aL_B, for_B);
	if(score1>score2){
		i1 = i1_A;
		i2 = i2_A;
		for(int i=0; i<aL_A; i++){
			alignSection[0][i] = alignSectionTmp[0][i];
			alignSection[1][i] = alignSectionTmp[1][i];
		}
		alignL = aL_A;
		forward1 = for_A;
		forward2 = true;
		bestScore = score1;
		if(!forward1)
			currOne = revOne;
	}else{
		i1 = i1_B;
		i2 = i2_B;
		alignL = aL_B;
		if(for_B)
			forward1 = false;
		else
			forward1 = true;
		forward2=false;
		if(!forward1)
			currOne = revOne;
		currTwo=revTwo;
		bestScore = score2;
	}	
//	PrintAlignmentConsensus(currOne,currTwo);
	
	delete revOne;
	delete revTwo;
	return(bestScore);
}

//Smith-Waterman Alignment
double SmithWaterman::AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward)
{
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* currMotif;
	AlignMatCell** currAlignMat;
	int i, j, z=0;
	double forScore, revScore;
	double maxScore=0;
	double tmp;
	int forMaxI, forMaxJ, revMaxI, revMaxJ;
	int max_i=0, max_j=0, start_i=0, start_j=0;
	alignLen=0;	
	AlignMatCell** forAlignMat;
	AlignMatCell** revAlignMat;


	int x=one->len+1;
	int y = two->len+1;
	//Make SW array
	forAlignMat = new AlignMatCell* [x];
	revAlignMat = new AlignMatCell* [x];
	for(i=0; i<x; i++){
		forAlignMat[i] = new AlignMatCell[y];
		revAlignMat[i] = new AlignMatCell[y];
		for(j=0; j<y; j++)
		{	forAlignMat[i][j].M=0;
			forAlignMat[i][j].point_i=0;
			forAlignMat[i][j].point_j=0;
			revAlignMat[i][j].M=0;
			revAlignMat[i][j].point_i=0;
			revAlignMat[i][j].point_j=0;
		}
	}

	//do in the forward and reverse directions
	for(int q=0; q<2; q++)
	{
		if(q==0){ currAlignMat=forAlignMat; currMotif=one;}
		else{	currAlignMat=revAlignMat; currMotif=revOne;}
		maxScore=-1000000;
		//Traverse the array, filling in the values
		for(i=1; i<x; i++) {
			for(j=1; j<y; j++) {

				//M calculation
				currAlignMat[i][j].M = currAlignMat[i-1][j-1].M + Metric->Compare(currMotif, i-1, two, j-1); 
				currAlignMat[i][j].point_i = i-1;
				currAlignMat[i][j].point_j = j-1;
								
				//Gap open calculation 1
				tmp = currAlignMat[i-1][j].M - gapOpen;
				if((currMotif->gaps[i-1]!=0 || two->gaps[i-1]!=0) && gapOpen!=1000) //Special case for a partial gap
                    tmp = currAlignMat[i-1][j].M - (gapOpen*(0.5));
					//tmp = currAlignMat[i-1][j].M - (gapOpen*(1/(currMotif->gaps[i-1]+two->gaps[j-1]+1)));
				if(currAlignMat[i][j].M<tmp){
					currAlignMat[i][j].M=tmp;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j;
				}
				
				//Gap open calculation 2
				tmp = currAlignMat[i][j-1].M - gapOpen;
				if((currMotif->gaps[i-1]!=0 || two->gaps[i-1]!=0) && gapOpen!=1000) //Special case for a partial gap
                    tmp = currAlignMat[i][j-1].M - (gapOpen*(0.5));
					//tmp = currAlignMat[i][j-1].M - (gapOpen*(1/(currMotif->gaps[i-1]+two->gaps[j-1]+1)));
				if(currAlignMat[i][j].M<tmp){
					currAlignMat[i][j].M=tmp;
					currAlignMat[i][j].point_i = i;
					currAlignMat[i][j].point_j = j-1;
				}

				if(!overlapOnly && currAlignMat[i][j].M<0){
					currAlignMat[i][j].M=0;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j-1;
				}
				currAlignMat[i][j].max = currAlignMat[i][j].M;
				if(currAlignMat[i][j].M>maxScore && (!overlapOnly ||(i==x-1 || j==y-1)))
				{	maxScore = currAlignMat[i][j].M; max_i=i; max_j=j;}
				
				if(q==0){ forScore=maxScore; forMaxI=max_i; forMaxJ=max_j;}
				else{	revScore=maxScore; revMaxI=max_i; revMaxJ=max_j;}
			}
		}
	}

	if(forScore>revScore){
		forward=true; alignForward=true; maxScore=forScore;
		start_i = forMaxI; start_j=forMaxJ;
		currAlignMat = forAlignMat; currMotif = one;
	}else{
		forward=false; alignForward=false; maxScore=revScore;
		start_i = revMaxI; start_j=revMaxJ;
		currAlignMat = revAlignMat; currMotif = revOne;
	}


	//This part aims to include the right side region into the alignment
	if(overlapOnly && extendOverlap){
		//right tail here
		if(!(start_i==x-1 && start_j==y-1)){
			if(start_i==x-1){
				i=start_i;
				for(j=start_j+1; j<y; j++){
					currAlignMat[i][j].max=maxScore;
					currAlignMat[i][j].M=maxScore;
					currAlignMat[i][j].point_i = i;
					currAlignMat[i][j].point_j = j-1;
				}
			}else{
				j=start_j;
				for(i=start_i+1; i<x; i++){
					currAlignMat[i][j].max=maxScore;
					currAlignMat[i][j].M=maxScore;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j;
				}
			}
			start_i=x-1; start_j=y-1;
		}
	}

	//Traceback
	tmp=maxScore;
	int tmp_si, tmp_sj;
	while((tmp>0 && !overlapOnly && (start_i!=0 && start_j!=0))||(overlapOnly && extendOverlap && (start_i!=0 || start_j!=0)) || (overlapOnly && !extendOverlap && (start_i!=0 && start_j!=0)))
	{	
		alignSection[0][z]=start_i-1;
		alignSection[1][z]=start_j-1;

		//This part aims to put the left tail into the alignment
		if(overlapOnly && extendOverlap && (start_i==0 || start_j==0)){
			if(start_i==0){
				start_j = start_j-1;
			}else{
				start_i = start_i-1;
			}
		}else{
			tmp_si=start_i; tmp_sj=start_j;
			start_i=currAlignMat[tmp_si][tmp_sj].point_i; 		
			start_j=currAlignMat[tmp_si][tmp_sj].point_j;
		}

		tmp=currAlignMat[start_i][start_j].max;
		z++;
	}
	
	i1=start_i;
	i2=start_j;
	alignL=z;
	alignLen=z;

	alignScore = maxScore;
//	PrintAlignmentConsensus(currMotif,two);

	for(i=0; i<x; i++)
	{
		delete [] forAlignMat[i];
		delete [] revAlignMat[i];
	}
	delete [] forAlignMat;
	delete [] revAlignMat;
	delete revOne;

	return(maxScore);
}


//SmithWaterman: no gaps allowed
//This does a very specific job; it finds the core (local, non-overlapping) alignment first and then extends in either direction
double SmithWatermanUngappedExtended::AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward)
{
	//****************************************************/
	// Cut out the core of the matrices
	int c1_start_offset, c1_stop_offset;
	Motif* core_one = TrimEdges(one, c1_start_offset, c1_stop_offset);
	int c2_start_offset, c2_stop_offset;
	Motif* core_two = TrimEdges(two, c2_start_offset, c2_stop_offset);
	int start_offset, stop_offset;
	//****************************************************/
	
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* revCoreOne = new Motif(core_one->GetLen());
	core_one->RevCompMotif(revCoreOne);
	Motif* currMotif;
	AlignMatCell** currAlignMat;
	int i, j, z=0;
	double forScore, revScore;
	double maxScore=0, currMax=0;
	double tmp;
	int forMaxI, forMaxJ, revMaxI, revMaxJ;
	int max_i=0, max_j=0, start_i=0, start_j=0;
	alignLen=0;	
	AlignMatCell** forAlignMat;
	AlignMatCell** revAlignMat;

	int x=one->len+1;
	int y = two->len+1;
	//Make SW array
	forAlignMat = new AlignMatCell* [x];
	revAlignMat = new AlignMatCell* [x];
	for(i=0; i<x; i++){
		forAlignMat[i] = new AlignMatCell[y];
		revAlignMat[i] = new AlignMatCell[y];
		for(j=0; j<y; j++)
		{	
			forAlignMat[i][j].M=0;
			revAlignMat[i][j].M=0;
			forAlignMat[i][j].Ix=0;
			revAlignMat[i][j].Ix=0;
			forAlignMat[i][j].Iy=0;
			revAlignMat[i][j].Iy=0;
			forAlignMat[i][j].point_i=0;
			forAlignMat[i][j].point_j=0;
			revAlignMat[i][j].point_i=0;
			revAlignMat[i][j].point_j=0;
		}
	}
	for(i=1; i<x; i++){
		for(j=1; j<y; j++){
			forAlignMat[i][j].point_i=i-1;
			forAlignMat[i][j].point_j=j-1;
			revAlignMat[i][j].point_i=i-1;
			revAlignMat[i][j].point_j=j-1;
		}
	}
		

	//do in the forward and reverse directions
	for(int q=0; q<2; q++)
	{
		if(q==0){ currAlignMat=forAlignMat; currMotif=core_one; start_offset = c1_start_offset; stop_offset=c1_stop_offset;}
		else{	currAlignMat=revAlignMat; currMotif=revCoreOne; start_offset = c1_stop_offset; stop_offset=c1_start_offset;}
		maxScore=-1000000;
		//Traverse the array, filling in the values
		for(i=1+start_offset; i<x-stop_offset; i++) {
			for(j=1+c2_start_offset; j<y-c2_stop_offset; j++) {

				//M update
				currAlignMat[i][j].M = currAlignMat[i-1][j-1].M + Metric->Compare(currMotif, (i-start_offset)-1, core_two, (j-c2_start_offset)-1); 
				currAlignMat[i][j].point_i = i-1; currAlignMat[i][j].point_j = j-1;
				
				if(currAlignMat[i][j].M<0){
					currAlignMat[i][j].M=0;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j-1;
				}

				currAlignMat[i][j].max = currAlignMat[i][j].M;		
				if(currAlignMat[i][j].max>maxScore )// && ((i==x-1 && j>=MIN_OVERLAP) || (j==y-1 && i>=MIN_OVERLAP)))
				{	maxScore = currAlignMat[i][j].max; max_i=i; max_j=j;}
			}
		}
		if(q==0){ forScore=maxScore; forMaxI=max_i; forMaxJ=max_j;}
		else{	revScore=maxScore; revMaxI=max_i; revMaxJ=max_j;}
	}

	if(forScore>revScore){
		forward=true; alignForward=true; maxScore=forScore;
		start_i = forMaxI; start_j=forMaxJ;
		currAlignMat = forAlignMat; currMotif = one;
	}else{
		forward=false; alignForward=false; maxScore=revScore;
		start_i = revMaxI; start_j=revMaxJ;
		currAlignMat = revAlignMat; currMotif = revOne;
	}

	//right hand side addition
	while(start_i!=x-1 && start_j!=y-1){
		start_i++;
		start_j++;
		currAlignMat[start_i][start_j].max=maxScore;
		currAlignMat[start_i][start_j].M=maxScore;
		currAlignMat[start_i][start_j].point_i = start_i-1;
		currAlignMat[start_i][start_j].point_j = start_j-1;
	}
	if(!(start_i==x-1 && start_j==y-1)){
		if(start_i==x-1){
			i=start_i;
			for(j=start_j+1; j<y; j++){
				currAlignMat[i][j].max=maxScore;
				currAlignMat[i][j].M=maxScore;
				currAlignMat[i][j].point_i = i;
				currAlignMat[i][j].point_j = j-1;
			}
		}else{
			j=start_j;
			for(i=start_i+1; i<x; i++){
				currAlignMat[i][j].max=maxScore;
				currAlignMat[i][j].M=maxScore;
				currAlignMat[i][j].point_i = i-1;
				currAlignMat[i][j].point_j = j;
			}
		}
		start_i=x-1; start_j=y-1;
	}
	

	//Traceback
	tmp = maxScore;
	int tmp_si, tmp_sj;
	while((start_i!=0 || start_j!=0))
	{	
		alignSection[0][z]=start_i-1;
		alignSection[1][z]=start_j-1;
		
		//This part aims to put the left tail into the alignment
		if(start_i==0 || start_j==0){
			if(start_i==0){
				start_j = start_j-1;
			}else{
				start_i = start_i-1;
			}
		}else{
			tmp_si=start_i; tmp_sj=start_j;
			start_i=currAlignMat[tmp_si][tmp_sj].point_i; 		
			start_j=currAlignMat[tmp_si][tmp_sj].point_j;
		}

		tmp=currAlignMat[start_i][start_j].max;
		z++;
	}

	i1=start_i;
	i2=start_j;
	alignL=z;
	alignLen=z;

	alignScore = maxScore;

	for(i=0; i<x; i++)
	{
		delete [] forAlignMat[i];
		delete [] revAlignMat[i];
	}
	delete [] forAlignMat;
	delete [] revAlignMat;
	delete core_one;
	delete core_two;
	delete revOne;
	delete revCoreOne;

	return(maxScore);
}

//Needleman-Wunsch with affine gap cost Alignment
double NeedlemanWunsch::AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward)
{
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* currMotif;
	AlignMatCell** currAlignMat;
	int i, j, z=0;
	double forScore, revScore;
	double maxScore=0, currMax=0;
	double tmp;
	int forMaxI, forMaxJ, revMaxI, revMaxJ;
	int max_i=0, max_j=0, start_i=0, start_j=0;
	alignLen=0;	
	AlignMatCell** forAlignMat;
	AlignMatCell** revAlignMat;

	int x=one->len+1;
	int y = two->len+1;
	//Make SW array
	forAlignMat = new AlignMatCell* [x];
	revAlignMat = new AlignMatCell* [x];
	for(i=0; i<x; i++){
		forAlignMat[i] = new AlignMatCell[y];
		revAlignMat[i] = new AlignMatCell[y];
		for(j=0; j<y; j++)
		{	
			forAlignMat[i][j].M=0;
			forAlignMat[i][j].Ix=0; forAlignMat[i][j].Iy=0;
			forAlignMat[i][j].point_i=0;
			forAlignMat[i][j].point_j=0;
			revAlignMat[i][j].M=0;
			revAlignMat[i][j].Ix=0; revAlignMat[i][j].Iy=0;
			revAlignMat[i][j].point_i=0;
			revAlignMat[i][j].point_j=0;
		}
	}
	//Edge initialisation
	if(gapOpen!=1000){
		forAlignMat[1][0].M=-1*gapOpen;forAlignMat[1][0].Ix=-1*gapOpen; forAlignMat[1][0].Iy=-1*gapOpen;
		revAlignMat[1][0].M=-1*gapOpen;revAlignMat[1][0].Ix=-1*gapOpen; revAlignMat[1][0].Iy=-1*gapOpen;
		forAlignMat[0][1].M=-1*gapOpen;forAlignMat[0][1].Ix=-1*gapOpen; forAlignMat[0][1].Iy=-1*gapOpen;
		revAlignMat[0][1].M=-1*gapOpen;revAlignMat[0][1].Ix=-1*gapOpen; revAlignMat[0][1].Iy=-1*gapOpen;
	}
	for(i=2; i<x; i++){
		if(gapOpen!=1000){
			forAlignMat[i][0].M=forAlignMat[i-1][0].M-gapExtend;
			forAlignMat[i][0].Ix=forAlignMat[i-1][0].Ix-gapExtend; forAlignMat[i][0].Iy=forAlignMat[i-1][0].Iy-gapExtend;
			revAlignMat[i][0].M=revAlignMat[i-1][0].M-gapExtend;
			revAlignMat[i][0].Ix=revAlignMat[i-1][0].Ix-gapExtend; revAlignMat[i][0].Iy=revAlignMat[i-1][0].Iy-gapExtend;
		}
		forAlignMat[i][0].point_i=i-1;forAlignMat[i][0].point_j=0;
		revAlignMat[i][0].point_i=i-1;revAlignMat[i][0].point_j=0;
	}
	for(j=2; j<y; j++){
		if(gapOpen!=1000){
			forAlignMat[0][j].M=forAlignMat[0][j-1].M-gapExtend;
			forAlignMat[0][j].Ix=forAlignMat[0][j-1].Ix-gapExtend; forAlignMat[0][j].Iy=forAlignMat[0][j-1].Iy-gapExtend;
			revAlignMat[0][j].M=revAlignMat[0][j-1].M-gapExtend;
			revAlignMat[0][j].Ix=revAlignMat[0][j-1].Ix-gapExtend; revAlignMat[0][j].Iy=revAlignMat[0][j-1].Iy-gapExtend;
		}
		forAlignMat[0][j].point_i=0;forAlignMat[0][j].point_j=j-1;		
		revAlignMat[0][j].point_i=0;revAlignMat[0][j].point_j=j-1;
	}
	for(i=0; i<x; i++)
		for(j=0; j<y; j++)
		{	forAlignMat[i][j].max = forAlignMat[i][j].M; revAlignMat[i][j].max = revAlignMat[i][j].M; }
	//End of initialisation

	//do in the forward and reverse directions
	for(int q=0; q<2; q++)
	{
		if(q==0){ currAlignMat=forAlignMat; currMotif=one;}
		else{	currAlignMat=revAlignMat; currMotif=revOne;}
		maxScore=-1000000;
		//Traverse the array, filling in the values
		for(i=1; i<x; i++) {
			for(j=1; j<y; j++) {

				//M update
				currAlignMat[i][j].M = currAlignMat[i-1][j-1].M + Metric->Compare(currMotif, i-1, two, j-1); 
				currAlignMat[i][j].point_i = i-1; currAlignMat[i][j].point_j = j-1;
				tmp = currAlignMat[i-1][j-1].Ix + Metric->Compare(currMotif, i-1, two, j-1); 
				if(currAlignMat[i][j].M<tmp){currAlignMat[i][j].M=tmp;}
				tmp = currAlignMat[i-1][j-1].Iy + Metric->Compare(currMotif, i-1, two, j-1); 
				if(currAlignMat[i][j].M<tmp){currAlignMat[i][j].M=tmp;}
				currMax = currAlignMat[i][j].M;

				//Ix update
				if((currMotif->gaps[i-1]!=0 || two->gaps[i-1]!=0) && gapOpen != 1000){
					currAlignMat[i][j].Ix = currAlignMat[i-1][j].M - (gapOpen *0.5);//Special case for partial gaps incorporated
					tmp = currAlignMat[i-1][j].Ix - (gapExtend *0.5);//Special case for partial gaps incorporated;
				}else{
					currAlignMat[i][j].Ix = currAlignMat[i-1][j].M - (gapOpen);
					tmp = currAlignMat[i-1][j].Ix - (gapExtend);
				}
				if(currAlignMat[i][j].Ix<tmp && i>1){currAlignMat[i][j].Ix=tmp;}
				if(currAlignMat[i][j].Ix>currMax){
					currMax= currAlignMat[i][j].Ix;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j;
				}
				
				//Iy update
				if((currMotif->gaps[i-1]!=0 || two->gaps[i-1]!=0) && gapOpen != 1000){
					currAlignMat[i][j].Iy = currAlignMat[i][j-1].M - (gapOpen *0.5);//Special case for partial gaps incorporated
					tmp = currAlignMat[i][j-1].Iy - (gapExtend *0.5);//Special case for partial gaps incorporated;
				}else{
					currAlignMat[i][j].Iy = currAlignMat[i][j-1].M - (gapOpen);
					tmp = currAlignMat[i][j-1].Iy - (gapExtend);
				}
				if(currAlignMat[i][j].Iy<tmp && j>1){currAlignMat[i][j].Iy=tmp;}
				if(currAlignMat[i][j].Iy>currMax){
					currMax= currAlignMat[i][j].Iy;
					currAlignMat[i][j].point_i = i;
					currAlignMat[i][j].point_j = j-1;
				}
				currAlignMat[i][j].max = currMax;
				
				//Minimum overlap length enforced here!
				if(currMax>maxScore && (gapOpen==1000 &&((i==x-1 && j>=MIN_OVERLAP) || (j==y-1 && i>=MIN_OVERLAP))))
				{	maxScore = currMax; max_i=i; max_j=j;}
								
			}
		}
		if(gapOpen!=1000)
		{	maxScore = currAlignMat[x-1][y-1].max;
			max_i=x-1; max_j=y-1;
		}
		if(q==0){ forScore=maxScore; forMaxI=max_i; forMaxJ=max_j;}
		else{	revScore=maxScore; revMaxI=max_i; revMaxJ=max_j;}

	}

	if(forScore>revScore){
		forward=true; alignForward=true; maxScore=forScore;
		start_i = forMaxI; start_j=forMaxJ;
		currAlignMat = forAlignMat; currMotif = one;
	}else{
		forward=false; alignForward=false; maxScore=revScore;
		start_i = revMaxI; start_j=revMaxJ;
		currAlignMat = revAlignMat; currMotif = revOne;
	}

	//right hand side addition (special case for no gaps)
	if(gapOpen==1000 && !(start_i==x-1 && start_j==y-1)){
		if(start_i==x-1){
			i=start_i;
			for(j=start_j+1; j<y; j++){
				currAlignMat[i][j].max=maxScore;
				currAlignMat[i][j].M=maxScore;
				currAlignMat[i][j].point_i = i;
				currAlignMat[i][j].point_j = j-1;
			}
		}else{
			j=start_j;
			for(i=start_i+1; i<x; i++){
				currAlignMat[i][j].max=maxScore;
				currAlignMat[i][j].M=maxScore;
				currAlignMat[i][j].point_i = i-1;
				currAlignMat[i][j].point_j = j;
			}
		}
		start_i=x-1; start_j=y-1;
	}

	//Traceback
	tmp = maxScore;
	int tmp_si, tmp_sj;
	while(start_i!=0 || start_j!=0)
	{	
		alignSection[0][z]=start_i-1;
		alignSection[1][z]=start_j-1;

		tmp_si=start_i; tmp_sj=start_j;
		start_i=currAlignMat[tmp_si][tmp_sj].point_i; 
		start_j=currAlignMat[tmp_si][tmp_sj].point_j;

		tmp=currAlignMat[start_i][start_j].max;
		z++;
	}

	i1=start_i;
	i2=start_j;
	alignL=z;
	alignLen=z;

	alignScore = maxScore;

	for(i=0; i<x; i++)
	{
		delete [] forAlignMat[i];
		delete [] revAlignMat[i];
	}
	delete [] forAlignMat;
	delete [] revAlignMat;
	delete revOne;

	return(maxScore);
}

//Smith-Waterman with affine gap cost Alignment
double SmithWatermanAffine::AlignMotifs(Motif* one, Motif* two, int &i1, int &i2, int& alignL, bool& forward)
{
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* currMotif;
	AlignMatCell** currAlignMat;
	int i, j, z=0;
	double forScore, revScore;
	double maxScore=0, currMax=0;
	double tmp;
	int forMaxI, forMaxJ, revMaxI, revMaxJ;
	int max_i=0, max_j=0, start_i=0, start_j=0;
	alignLen=0;	
	AlignMatCell** forAlignMat;
	AlignMatCell** revAlignMat;


	int x=one->len+1;
	int y = two->len+1;
	//Make SW array
	forAlignMat = new AlignMatCell* [x];
	revAlignMat = new AlignMatCell* [x];
	for(i=0; i<x; i++){
		forAlignMat[i] = new AlignMatCell[y];
		revAlignMat[i] = new AlignMatCell[y];
		for(j=0; j<y; j++)
		{	forAlignMat[i][j].M=0;
			forAlignMat[i][j].Ix=0; forAlignMat[i][j].Iy=0;
			forAlignMat[i][j].point_i=0;
			forAlignMat[i][j].point_j=0;
			revAlignMat[i][j].M=0;
			revAlignMat[i][j].Ix=0; revAlignMat[i][j].Iy=0;
			revAlignMat[i][j].point_i=0;
			revAlignMat[i][j].point_j=0;
		}
	}

	//do in the forward and reverse directions
	for(int q=0; q<2; q++)
	{
		if(q==0){ currAlignMat=forAlignMat; currMotif=one;}
		else{	currAlignMat=revAlignMat; currMotif=revOne;}
		maxScore=-1000;
		//Traverse the array, filling in the values
		for(i=1; i<x; i++) {
			for(j=1; j<y; j++) {

				currMax=0;
				//M update
				currAlignMat[i][j].M = currAlignMat[i-1][j-1].M + Metric->Compare(currMotif, i-1, two, j-1); 
				currAlignMat[i][j].point_i = i-1; currAlignMat[i][j].point_j = j-1;
				tmp = currAlignMat[i-1][j-1].Ix + Metric->Compare(currMotif, i-1, two, j-1); 
				if(currAlignMat[i][j].M<tmp){currAlignMat[i][j].M=tmp;}
				tmp = currAlignMat[i-1][j-1].Iy + Metric->Compare(currMotif, i-1, two, j-1); 
				if(currAlignMat[i][j].M<tmp){currAlignMat[i][j].M=tmp;}
				currMax = currAlignMat[i][j].M;

				//Ix update
				if((currMotif->gaps[i-1]!=0 || two->gaps[i-1]!=0) && gapOpen != 1000){
					currAlignMat[i][j].Ix = currAlignMat[i-1][j].M - (gapOpen *0.5);//Special case for partial gaps incorporated
					tmp = currAlignMat[i-1][j].Ix - (gapExtend *0.5);//Special case for partial gaps incorporated
				}else{
					currAlignMat[i][j].Ix = currAlignMat[i-1][j].M - (gapOpen);
					tmp = currAlignMat[i-1][j].Ix - (gapExtend);
				}
				if(currAlignMat[i][j].Ix<tmp && i>1){currAlignMat[i][j].Ix=tmp;}
				if(currAlignMat[i][j].Ix>currMax){
					currMax= currAlignMat[i][j].Ix;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j;
				}
				
				//Iy update
				if((currMotif->gaps[i-1]!=0 || two->gaps[i-1]!=0) && gapOpen != 1000){
					currAlignMat[i][j].Iy = currAlignMat[i][j-1].M - (gapOpen *0.5);//Special case for partial gaps incorporated
					tmp = currAlignMat[i][j-1].Iy - (gapExtend *0.5);//Special case for partial gaps incorporated
				}else{
					currAlignMat[i][j].Iy = currAlignMat[i][j-1].M - (gapOpen);
					tmp = currAlignMat[i][j-1].Iy - (gapExtend);
				}
				if(currAlignMat[i][j].Iy<tmp && j>1){currAlignMat[i][j].Iy=tmp;}
				if(currAlignMat[i][j].Iy>currMax){
					currMax= currAlignMat[i][j].Iy;
					currAlignMat[i][j].point_i = i;
					currAlignMat[i][j].point_j = j-1;
				}
				currAlignMat[i][j].max = currMax;
				if(!overlapOnly && currAlignMat[i][j].M<0){
					currAlignMat[i][j].M=0;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j-1;
				}
				
				//Minimum overlap length enforced here!
				if(currMax>maxScore && (!overlapOnly ||((i==x-1 && j>=MIN_OVERLAP) || (j==y-1 && i>=MIN_OVERLAP))))
				{	maxScore = currMax; max_i=i; max_j=j;}
								
			}
		}
		if(q==0){ forScore=maxScore; forMaxI=max_i; forMaxJ=max_j;}
		else{	revScore=maxScore; revMaxI=max_i; revMaxJ=max_j;}
	}

	if(forScore>revScore){
		forward=true; alignForward=true; maxScore=forScore;
		start_i = forMaxI; start_j=forMaxJ;
		currAlignMat = forAlignMat; currMotif = one;
	}else{
		forward=false; alignForward=false; maxScore=revScore;
		start_i = revMaxI; start_j=revMaxJ;
		currAlignMat = revAlignMat; currMotif = revOne;
	}

	//This part aims to include the right side region into the alignment
	if(overlapOnly && extendOverlap){
		//right tail here
		if(!(start_i==x-1 && start_j==y-1)){
			if(start_i==x-1){
				i=start_i;
				for(j=start_j+1; j<y; j++){
					currAlignMat[i][j].max=maxScore;
					currAlignMat[i][j].M=maxScore;
					currAlignMat[i][j].point_i = i;
					currAlignMat[i][j].point_j = j-1;
				}
			}else{
				j=start_j;
				for(i=start_i+1; i<x; i++){
					currAlignMat[i][j].max=maxScore;
					currAlignMat[i][j].M=maxScore;
					currAlignMat[i][j].point_i = i-1;
					currAlignMat[i][j].point_j = j;
				}
			}
			start_i=x-1; start_j=y-1;
		}
	}

	//Traceback
	tmp = maxScore;
	int tmp_si, tmp_sj;
	while((tmp>0 && !overlapOnly && (start_i!=0 && start_j!=0)) || (overlapOnly && extendOverlap && (start_i!=0 || start_j!=0)) || (overlapOnly && !extendOverlap && (start_i!=0 && start_j!=0)))
	{	
		alignSection[0][z]=start_i-1;
		alignSection[1][z]=start_j-1;

		//This part aims to put the left tail into the alignment
		if(overlapOnly && extendOverlap && (start_i==0 || start_j==0)){
			if(start_i==0){
				start_j = start_j-1;
			}else{
				start_i = start_i-1;
			}
		}else{
			tmp_si=start_i; tmp_sj=start_j;
			start_i=currAlignMat[tmp_si][tmp_sj].point_i; 		
			start_j=currAlignMat[tmp_si][tmp_sj].point_j;
		}

		tmp=currAlignMat[start_i][start_j].max;
		z++;
	}

	i1=start_i;
	i2=start_j;
	alignL=z;
	alignLen=z;


	alignScore = maxScore;

	for(i=0; i<x; i++)
	{
		delete [] forAlignMat[i];
		delete [] revAlignMat[i];
	}
	delete [] forAlignMat;
	delete [] revAlignMat;
	delete revOne;

	return(maxScore);
}

//Return the info content for a column
double Alignment::Info(double* col)
{
	double sum=0;
	for(int b=0;b<B;b++) {
		if(col[b]) {
			sum+=col[b]*(log(col[b])/LOG_2);
		}
	}
	return 2+sum;
}

//Trim the edges from a Motif
Motif* Alignment::TrimEdges(Motif* in, int &start_offset, int &stop_offset, int minLen, bool allowExclusive)
{
	int i,j,b;
	double maxIC=0;
	double currIC=0;
	int startWin=0, stopWin=in->GetLen()-1;
	//first find the window of greatest IC
	if(in->GetLen()<=minLen || (allowExclusive && in->members<=1)){
		startWin=0; stopWin = in->GetLen();
	}else{
		
		for(i=0; i<in->GetLen()-minLen; i++){
			currIC=0;
			for(j=i; j<i+minLen; j++){
				currIC+=in->Info(j);
			}
			if(currIC>maxIC){
				maxIC=currIC;
				startWin=i;
				stopWin=i+minLen;
			}
		}
	}
	
	//now scan either side of the alignment, deleting columns as necessary
	int mStart=0, mStop = in->GetLen()-1;
	bool run=true;
	for(i=0; i<startWin && run; i++){
		if((in->Info(i)<MIN_INFO || in->gaps[i]>(in->members/2)) && (!allowExclusive || in->members>1)){
			mStart++;
		}else{
			run=false;
		}
	}run=true;
	for(i=in->GetLen()-1; i>=stopWin && run; i--){
		if((in->Info(i)<MIN_INFO || in->gaps[i]>(in->members/2)) && (!allowExclusive || in->members>1)){
			mStop--;
		}else{
			run=false;
		}
	}
	int nLen = (mStop-mStart)+1;
	Motif* newProfile = new Motif(nLen);
	i=0;
	newProfile->members = in->members;
	strcpy(newProfile->name, in->name);
	//delete columns in the motif
	for(j=mStart; j<=mStop; j++){
		for(b=0; b<B; b++){
			newProfile->f[i][b]=in->f[j][b];
			newProfile->n[i][b]=in->n[j][b];
			newProfile->pwm[i][b]=in->pwm[j][b];
		}
		newProfile->gaps[i] = in->gaps[j];
		i++;
	}
	start_offset = mStart;
	stop_offset = in->len - mStop-1;

	return(newProfile);
}

