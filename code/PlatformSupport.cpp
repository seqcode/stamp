//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// PlatformSupport.cpp
//
// Started: 1st Nov 2005
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



#include "PlatformSupport.h"
#include <gsl/gsl_randist.h>
#include <gsl/gsl_cdf.h>
#include <gsl/gsl_histogram.h>

//Constructor
PlatformSupport::PlatformSupport()
{
	matCount=0; 
	matchDBSize=0;
	markov=NULL; 
	charMap=NULL; 
	scoreDistStdDev=NULL;
	scoreDistMean = NULL;
	pairwiseAlign=NULL;
	backgroundOrder=0;
	usingWeighting=false;
	
	charMap=(char***)malloc((MAX_MARKOV+1)*sizeof(char**));
	markov=(double**)malloc((MAX_MARKOV+1)*sizeof(double*));
	
	for(int j=1;j<=MAX_MARKOV;j++)
	{
		markov[j]=(double*)malloc(((int)pow(B,j))*sizeof(double));
		charMap[j]=(char**)malloc(((int)pow(B,j))*sizeof(char*));
		for(int i=0;i<pow(B,j);i++) 
			charMap[j][i]=(char*)malloc((j+1)*sizeof(char));
	}
	backgroundSet=false;
}

//Read in a Markov background
void PlatformSupport::ReadBackground(char* fn)
{
	char *xmer;
	int i,j;
	double px;
	
	xmer=(char*)malloc((MAX_MARKOV+1)*sizeof(char));
	
	if(fn!=NULL){
		FILE* modelp = fopen(fn, "r");
		if(modelp==NULL){perror("Cannot open background file");exit(1);}
	
		while(fscanf(modelp,"%d %s %lf\n",&i,xmer,&px) != EOF)
		{
			j=strlen(xmer);
			strcpy(charMap[j][i], xmer);
			markov[j][i]=px;
		}
		backgroundOrder=j;

		fclose(modelp);
	}else{
		//Set background to neutral bias
		backgroundOrder=1;
		markov[1][0]=.25; markov[1][1]=.25; markov[1][2]=.25; markov[1][3]=.25;
		strcpy(charMap[1][0], "A"); strcpy(charMap[1][1], "C"); strcpy(charMap[1][2], "G"); strcpy(charMap[1][3], "T");
	}

	backgroundSet=true;
	free(xmer);
}

//Read in a TransFac file
int PlatformSupport::ReadTransfacFile(char* fn, bool famNames, bool input, bool useweighting)
{
	int i, j;
	FILE* inp;
	char line[LONG_STR];
	char tag[STR_LEN];
	Motif* tmp_Motif = new Motif(MAX_MOTIF_LEN);
	int curr_cnt=0;
	double curr_ttl;
	bool recording=false;
	double tmpWeight=0;
	Motif** currMotifs; int currCnt;

	if(input){
		currMotifs=inputMotifs;
		currCnt=matCount;
	}else{
		currMotifs=matchMotifs;
		currCnt=matchDBSize;
	}
	currCnt=0;
	
	if(!backgroundSet)
	{	printf("ReadBackground not called; exiting");
		exit(1);
	}

	if(useweighting){
		usingWeighting=true;
		total_weight=0;
	}

	//read in the Motif input file.
	inp = fopen(fn, "r");
	if(inp==NULL){perror("Cannot open input file");exit(1);}
	while(!feof(inp)){
		fgets(line, LONG_STR, inp);
		//Read the first word. 3 cases handled at the moment
		sscanf(line, " %s", tag);

		if(strcmp(tag, "DE")==0)
		{
			if(famNames)
			{	sscanf(line, " %s %s %s", tag, tmp_Motif->name, tmp_Motif->famName);
			}else if(useweighting){
				sscanf(line, " %s %s %lf", tag, tmp_Motif->name, &tmpWeight); 
				tmp_Motif->weighting=tmpWeight; 
				total_weight+=tmp_Motif->weighting;
			}else{
				sscanf(line, " %s %s", tag, tmp_Motif->name);
			}
			curr_cnt=0;
			recording=true;
		}else if(strcmp(tag, "XX")==0){
			if(recording){ //copy the contents of tmp_Motif to a new spot in currMotifs
				currMotifs[currCnt] = new Motif(curr_cnt);
				if(useweighting)
					currMotifs[currCnt]->weighting=tmp_Motif->weighting;
				strcpy(currMotifs[currCnt]->name, tmp_Motif->name);
				if(famNames)
					strcpy(currMotifs[currCnt]->famName, tmp_Motif->famName);
				for(i=0; i<curr_cnt; i++){
					curr_ttl=0;
					for(j=0; j<B; j++)
					{	currMotifs[currCnt]->n[i][j] = tmp_Motif->n[i][j];
						curr_ttl+=tmp_Motif->n[i][j];
					}
					for(j=0; j<B; j++)
					{	currMotifs[currCnt]->f[i][j] = (tmp_Motif->n[i][j] + (SCALE_FACTOR*markov[1][j]))/(curr_ttl+SCALE_FACTOR);
						currMotifs[currCnt]->pwm[i][j] = log_2(currMotifs[currCnt]->f[i][j]/markov[1][j]);
					}
				}
				currCnt++;

				recording=false;
			}
		}else { //Assuming it's an integer value here!
			sscanf(line, " %s %lf %lf %lf %lf", tag, &tmp_Motif->n[curr_cnt][0], &tmp_Motif->n[curr_cnt][1], &tmp_Motif->n[curr_cnt][2], &tmp_Motif->n[curr_cnt][3]);
			curr_cnt++;
		}
	}
	delete tmp_Motif;

	if(input)
		matCount=currCnt;
	else
		matchDBSize=currCnt;

	return(currCnt);
}

//Find the scores distribution in the input Motifs
void PlatformSupport::GetRandDistrib(char* fn, Alignment* A_man)
{
	int i, j;
	int x, y;
	int align1, align2, aLen;
	bool forward1, forward2;
	double bestScore;
	FILE* out;
	out = fopen(fn, "w");
	if(out==NULL){perror("Cannot open output file");exit(1);}

	//Set up the mean and std_dev arrays
	double** sum = (double**)malloc(sizeof(double*)*maxLen);
	double** max = (double**)malloc(sizeof(double*)*maxLen);
	double** min = (double**)malloc(sizeof(double*)*maxLen);
	double** std_dev = (double**)malloc(sizeof(double*)*maxLen);
	double** count = (double**)malloc(sizeof(double*)*maxLen);
	double** sampSq = (double**)malloc(sizeof(double*)*maxLen);
	for(i=0; i<maxLen; i++) {
		sum[i] = (double*)malloc(sizeof(double)*maxLen);
		max[i] = (double*)malloc(sizeof(double)*maxLen);
		min[i] = (double*)malloc(sizeof(double)*maxLen);
		std_dev[i] = (double*)malloc(sizeof(double)*maxLen);
		count[i] = (double*)malloc(sizeof(double)*maxLen);
		sampSq[i] = (double*)malloc(sizeof(double)*maxLen);
		for(j=0; j<maxLen; j++) {
			max[i][j]=0;
			min[i][j]=100000;
			sum[i][j]=0;
			std_dev[i][j]=0;
			count[i][j]=0;
			sampSq[i][j]=0;
		}
	}
/////////////////////////////////////////////////////////
/*gsl_histogram* score_hist;
score_hist = gsl_histogram_alloc(200);
gsl_histogram_set_ranges_uniform(score_hist, -20, 20);
gsl_histogram* score_histB;
score_histB = gsl_histogram_alloc(200);
gsl_histogram_set_ranges_uniform(score_histB, -20, 20);
*//////////////////////////////////////////////////////////

	//Compare each matrix to every other matrix
	for(i=0; i<matCount; i++){
		for(j=0; j<i; j++) 
		{
			if(i!=j)
			{
				bestScore = A_man->AlignMotifs2D(inputMotifs[i], inputMotifs[j], align1, align2, aLen, forward1, forward2);
			               
				//Add bestScore to the proper mean and std_dev array
				x=inputMotifs[i]->len;
				if(x<minLen){x=minLen;}
				else if(x>=maxLen){x=maxLen-1;}
				y=inputMotifs[j]->len;
				if(y<minLen){y=minLen;}
				else if(y>=maxLen){y=maxLen-1;}
				sum[x][y]+=bestScore;
				sum[y][x]+=bestScore;
				sampSq[x][y] += (bestScore*bestScore);
				sampSq[y][x] += (bestScore*bestScore);
				count[x][y]++;
				count[y][x]++;
				if(bestScore>max[x][y])
					max[x][y]=bestScore;
				else if(bestScore<min[x][y])
					min[x][y]=bestScore;
				if(bestScore>max[y][x])
					max[y][x]=bestScore;
				else if(bestScore<min[y][x])
					min[y][x]=bestScore;
				
				/*///////////////////////////////////////////////////
				if(x==9 && y==6)
					gsl_histogram_increment(score_hist, bestScore);
				else if(x==9 && y==15)
					gsl_histogram_increment(score_histB, bestScore);
				*////////////////////////////////////////////////////
			}
		}
	}
	/*/////////////////////////////////////////////////
	printf("9 and 6\n\n");
	for(x=0; x<200; x++)
		printf("%lf\t%lf\n", (-20+((double)x*40/200)), gsl_histogram_get(score_hist, x));
	printf("\n\n9 and 15\n\n");
	for(x=0; x<200; x++)
		printf("%lf\t%lf\n", (-20+((double)x*40/200)), gsl_histogram_get(score_histB, x));
	gsl_histogram_reset(score_hist);
	gsl_histogram_reset(score_histB);
	*///////////////////////////////////////////////////	

	for(x=minLen; x<maxLen; x++)
		for(y=minLen; y<maxLen; y++)
		{	
			std_dev[x][y] = sampSq[x][y] -((sum[x][y]*sum[x][y])/count[x][y]);
			std_dev[x][y] = std_dev[x][y]/count[x][y];
			if(std_dev[x][y]!=0)
				std_dev[x][y] = sqrt(std_dev[x][y]);
		}

	for(x=minLen; x<maxLen; x++)
		for(y=minLen; y<maxLen; y++)
		{	if(count[x][y]>0)
				fprintf(out, "%d\t%d\t%lf\t%lf\t%.0lf\t%lf\t%lf\n", x, y, sum[x][y]/count[x][y], std_dev[x][y], count[x][y], min[x][y], max[x][y]);
			else
				fprintf(out, "%d\t%d\t%lf\t%lf\t%.0lf\t%lf\t%lf\n", x, y, 0, 0, 0, 0, 0);
		}

	////////////////////////////////////////////////////////
/*	printf("\n\nrand\n\n");
	double beta = sqrt((std_dev[9][6]*std_dev[9][6]) * 6/(M_PI*M_PI));
	double mode = (sum[9][6]/count[9][6]) - beta*Euler_Mascheroni;
	double r;
	for(i=0; i<17400; i++){
		r = ((double)rand())/RAND_MAX;
		bestScore = mode - (beta*log(-1*log(r)));
		gsl_histogram_increment(score_hist, bestScore);
	}
	for(x=0; x<200; x++)
		printf("%lf\t%lf\n", (-20+((double)x*40/200)), gsl_histogram_get(score_hist, x));
	printf("\n\n");
*/	////////////////////////////////////////////////////////
	
	for(i=0; i<maxLen; i++) {
		free(sum[i]);
		free(std_dev[i]);
		free(count[i]);
		free(sampSq[i]);
	}
	free(sum);
	free(std_dev);
	free(count);
	free(sampSq);
}

//Read in the score distance distributions
void PlatformSupport::ReadScoreDists(char* fn)
{
	FILE* inp;
	char line[STR_LEN];
	int i,j;
	int x, y;
	double mean, std_dev, count, max, min;

	//set up the matrices
	scoreDistMean = (double**)malloc(sizeof(double*)*maxLen);
	scoreDistMax = (double**)malloc(sizeof(double*)*maxLen);
	scoreDistMin = (double**)malloc(sizeof(double*)*maxLen);
	scoreDistStdDev = (double**)malloc(sizeof(double*)*maxLen);
	for(i=0; i<maxLen; i++) {
		scoreDistMean[i] = (double*)malloc(sizeof(double)*maxLen);
		scoreDistMax[i] = (double*)malloc(sizeof(double)*maxLen);
		scoreDistMin[i] = (double*)malloc(sizeof(double)*maxLen);
		scoreDistStdDev[i] = (double*)malloc(sizeof(double)*maxLen);
		for(j=0; j<maxLen; j++) {
			scoreDistMax[i][j]=0;
			scoreDistMin[i][j]=0;
			scoreDistMean[i][j]=0;
			scoreDistStdDev[i][j]=0;
		}
	}

	//read in the score distribution input file.
	inp = fopen(fn, "r");
	if(inp==NULL){perror("Cannot open input file");exit(1);}
	while(!feof(inp)){
		fgets(line, STR_LEN, inp);
		sscanf(line, " %d %d %lf %lf %lf %lf %lf", &x,&y,&mean, &std_dev, &count, &min, &max);
		scoreDistMean[x][y] =mean;
		scoreDistStdDev[x][y]=std_dev;
		scoreDistMax[x][y] =max;
		scoreDistMin[x][y] =min;
	}
	fclose(inp);
}

//Convert a Score to a Z-score given two lengths.
double PlatformSupport::Score2ZScore(int len1, int len2, double score)
{
	int l1=len1, l2=len2;
	double mean, std_dev;

	if(len1<minLen)
		l1=minLen;
	else if(len1>maxLen-1)
		l1=maxLen-1;
	if(len2<minLen)
		l2=minLen;
	else if(len2>maxLen-1)
		l2=maxLen-1;

	mean = scoreDistMean[l1][l2];
	std_dev=scoreDistStdDev[l1][l2];
	if(std_dev<=0)
		std_dev=1;
	
	return((score-mean)/std_dev);
}

//Private Method: Convert a Score to a P-value given two lengths.
double PlatformSupport::Score2PVal(int len1, int len2, double score)
{
	int l1=len1, l2=len2;
	double mean, std_dev;
	double start, stop, x, y, w;
	double p_val=0;
	bool minus;

	if(len1<minLen)
		l1=minLen;
	else if(len1>maxLen-1)
		l1=maxLen-1;
	if(len2<minLen)
		l2=minLen;
	else if(len2>maxLen-1)
		l2=maxLen-1;

	mean = scoreDistMean[l1][l2];
	std_dev=scoreDistStdDev[l1][l2];
	if(std_dev<=0)
		std_dev=1;

	start = score - mean;
	p_val = gsl_cdf_gaussian_P(start, std_dev);
	
	return(p_val);
}

//Private Method: Convert a Score to an approximate distance measure (from Feng & Doolittle)
double PlatformSupport::Score2Dist(int len1, int len2, double score, double maxScore)
{
	int l1=len1, l2=len2;
	double S_eff=0, S_rand;

	if(len1<minLen)
		l1=minLen;
	else if(len1>maxLen-1)
		l1=maxLen-1;
	if(len2<minLen)
		l2=minLen;
	else if(len2>maxLen-1)
		l2=maxLen-1;

	double std_dev=scoreDistStdDev[l1][l2];
	if(std_dev<=0)
		std_dev=1;
	S_rand = scoreDistMean[l1][l2] - 4*std_dev;
	S_rand = scoreDistMin[l1][l2];
	S_eff = (score - S_rand)/(maxScore - S_rand);

	if(S_eff <= 0)
		S_eff=-1*(log(0.001));
	else
		S_eff = -1*(log(S_eff));

	return((S_eff));
}

//Align all matrices against all others
void PlatformSupport::PreAlign(Alignment* A_man)
{
	int i, j;
	int i1, i2, aL;
	double curr_score, curr_z_score, curr_p_val, max_score;
	bool forward1, forward2;

	pairwiseAlign = new AlignRec*[matCount];
	for(i=0; i<matCount; i++)
	{	
		pairwiseAlign[i] = new AlignRec[matCount];
	}

	//firstly align each matrix to itself (to get max scores later)
	for(i=0; i<matCount; i++)
	{
		curr_score = A_man->AlignMotifs(inputMotifs[i], inputMotifs[i], i1, i2, aL, forward1);
		pairwiseAlign[i][i].forward1=forward1;
		pairwiseAlign[i][i].forward2=false;
		pairwiseAlign[i][i].i1=i1;
		pairwiseAlign[i][i].i2=i2;
		pairwiseAlign[i][i].score=curr_score;
		curr_z_score = Score2ZScore(inputMotifs[i]->len, inputMotifs[i]->len, curr_score);
		pairwiseAlign[i][i].z_score=curr_z_score;
		curr_p_val = Score2PVal(inputMotifs[i]->len, inputMotifs[i]->len, curr_score);
		pairwiseAlign[i][i].p_value = curr_p_val;
		pairwiseAlign[i][i].CopyAlignSec(A_man->alignSection, aL);
		strcpy(pairwiseAlign[i][i].alignedNames[0], inputMotifs[i]->name);
		strcpy(pairwiseAlign[i][i].alignedNames[1], inputMotifs[i]->name);
		pairwiseAlign[i][i].alignedIDs[0] = i; pairwiseAlign[i][i].alignedIDs[1] = i;
	}

	//Go through each possible set of alignments
	for(i=0; i<matCount; i++)
		for(j=0; j<matCount; j++){//Now possible to set j<i, as long as [i][j] and [j][i] are copied
			if(i!=j){
				curr_score = A_man->AlignMotifs2D(inputMotifs[i], inputMotifs[j], i1, i2, aL, forward1, forward2);
				pairwiseAlign[i][j].forward1=forward1;
				pairwiseAlign[i][j].forward2=forward2;
				pairwiseAlign[i][j].i1=i1;
				pairwiseAlign[i][j].i2=i2;
				pairwiseAlign[i][j].score=curr_score;
				curr_z_score = Score2ZScore(inputMotifs[i]->len, inputMotifs[j]->len, curr_score);
				pairwiseAlign[i][j].z_score=curr_z_score;
				curr_p_val = Score2PVal(inputMotifs[i]->len, inputMotifs[j]->len, curr_score);
				pairwiseAlign[i][j].p_value = curr_p_val;
				pairwiseAlign[i][j].CopyAlignSec(A_man->alignSection, aL);
				strcpy(pairwiseAlign[i][j].alignedNames[0], inputMotifs[i]->name);
				strcpy(pairwiseAlign[i][j].alignedNames[1], inputMotifs[j]->name);
				pairwiseAlign[i][i].alignedIDs[0] = i; pairwiseAlign[i][i].alignedIDs[1] = j;

				max_score = (pairwiseAlign[i][i].score + pairwiseAlign[j][j].score)/2;
				pairwiseAlign[i][j].dist = -1 * log(pairwiseAlign[i][j].p_value);
			}
		}
}

//Print out the pairwise alignments
void PlatformSupport::PrintPairwise()
{
	int i, j;
	for(j=0; j<matCount; j++){
		printf("\t%s",inputMotifs[j]->GetName());
	}printf("\n\n");

	for(i=0; i<matCount; i++){
		printf("%s\t",inputMotifs[i]->name);
		for(j=0; j<matCount; j++){
			if(i!=j){
				double Eval = 1-pairwiseAlign[i][j].p_value;
				printf("%e\t", Eval);
			}else
				printf("-\t");
		}
		printf("\n\n");
	}
}

//Find the best matching motifs in the match set and print the pairs to a file
void PlatformSupport::SimilarityMatching(Alignment* A_man, char* outFileName, bool famNames, const int matchTopX)
{
	double* topScores;
	int* topIndices;
	bool printAll=false;
	int i, j, x, y;
	double currScore, currPVal;
	Motif* one; Motif* two;
	int i1, i2, aL;
	bool forward1, forward2;
	char currName[STR_LEN];
	char outPairsName[STR_LEN];
	char outMatchedName[STR_LEN];
	sprintf(outPairsName, "%s_match_pairs.txt", outFileName);
	sprintf(outMatchedName, "%s_matched.transfac", outFileName);
	FILE* outPairs = fopen(outPairsName, "w");
	FILE* outMatched = fopen(outMatchedName, "w");
	char*** topAligns;
	int topX = matchTopX;
	if(topX>GetMatchDBSize()){
		topX=GetMatchDBSize();
	}
	bool inserted=false;
	topScores = new double[topX];
	topIndices = new int[topX];
	topAligns = new char**[topX];
	for(x=0; x<topX; x++){
		topScores[x]=0; topIndices[x]=0; 
		topAligns[x]=new char*[2];
		topAligns[x][0]=new char[STR_LEN];
		topAligns[x][1]=new char[STR_LEN];
		strcpy(topAligns[x][0], "");strcpy(topAligns[x][1], "");
	}

	if(printAll){
		printf("\t");
		for(j=0; j<GetMatchDBSize(); j++){
			printf("%s\t", matchMotifs[j]->GetName());
		}
		printf("\n");
	}
	for(i=0; i<GetMatCount(); i++){
		
		if(printAll)
			printf("%s\t", inputMotifs[i]->GetName());
		
		for(x=0; x<topX; x++){
			topScores[x]=0; topIndices[x]=0; 
			strcpy(topAligns[x][0], "");strcpy(topAligns[x][1], "");
		}

		for(j=0; j<GetMatchDBSize(); j++){
			currScore = A_man->AlignMotifs2D(inputMotifs[i], matchMotifs[j], i1, i2, aL, forward1, forward2);
			currPVal = Score2PVal(inputMotifs[i]->len, matchMotifs[j]->len, currScore);
			if(printAll){printf("%lf\t", currPVal);/*printf("%s\t%lf\n", matchMotifs[j]->GetName(),currPVal);*/}

			//Check the current score against the topScores
			inserted=false;
			for(x=0; x<topX && !inserted; x++){
				if(currPVal>topScores[x]){
					//Shift and insert
					for(y=topX-1; y>x; y--){
						topScores[y]=topScores[y-1];
						topIndices[y]=topIndices[y-1];
						strcpy(topAligns[y][0],topAligns[y-1][0]);
						strcpy(topAligns[y][1],topAligns[y-1][1]);
					}
					topScores[x] = currPVal;
					topIndices[x]=j;
					if(forward1){
						one = inputMotifs[i];
					}else{
						one = new Motif(inputMotifs[i]->GetLen());
						inputMotifs[i]->RevCompMotif(one);
					}
					if(forward2){
						two = matchMotifs[j];
					}else{
						two = new Motif(matchMotifs[j]->GetLen());
						matchMotifs[j]->RevCompMotif(two);
					}
					A_man->CopyAlignmentConsensus(one, two,topAligns[x][0], topAligns[x][1]);
					if(!forward1){
						delete one;
					}if(!forward2){
						delete two;
					}
					inserted=true;

				}
			}
		}
		if(printAll){printf("\n");}

		fprintf(outPairs, ">\t%s\n", inputMotifs[i]->GetName());
		for(x=0; x<topX; x++){
			if(famNames){
				sprintf(currName, "%s_%s", matchMotifs[topIndices[x]]->famName, matchMotifs[topIndices[x]]->GetName());
			}else{
				sprintf(currName, "%s", matchMotifs[topIndices[x]]->GetName());
			}
			double Eval = 1-topScores[x];
			fprintf(outPairs, "%s\t%.4e\t%s\t%s\n", currName, Eval, topAligns[x][0], topAligns[x][1]);
			matchMotifs[topIndices[x]]->PrintMotif(outMatched, famNames);
		}
	}

	fclose(outMatched);
	fclose(outPairs);
	delete [] topScores;
	delete [] topIndices;
	for(x=0; x<topX; x++){
		delete [] topAligns[x][0];delete [] topAligns[x][1];
		delete [] topAligns[x];
	}delete [] topAligns;
}

////////////////////////////////////////////////////////////////////////////////////
///////////  Motif Helpers  ////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

//Convert f to n (multiply by 100)
void PlatformSupport::f_to_n(Motif* m)
{
	for(int i=0; i<m->GetLen(); i++){
		for(int j=0; j<B; j++){
			m->n[i][j] = floor(m->f[i][j]*DFLT_NUM_INSTANCES);
		}
	}
}
//Convert n to pwm
void PlatformSupport::n_to_pwm(Motif* m)
{
	int i,j;
	double ttl;
	for(i=0; i<m->GetLen(); i++){
		ttl=0;
		for(j=0; j<B; j++){ttl += m->n[i][j];}
		for(j=0; j<B; j++)
			m->pwm[i][j] = log_2(((m->n[i][j] + (SCALE_FACTOR*markov[1][j]))/(ttl+SCALE_FACTOR))/markov[1][j]);
	}
}

//Information content
double PlatformSupport::InfoContent(Motif* m)
{
	double sum=0.0;
	
	for(int j=0;j<m->GetLen();j++) {
		for(int b=0;b<B;b++) {
			if(m->f[j][b]) {
				sum+=m->f[j][b]*log_2(m->f[j][b]);
			}
		}
	}
	return 2+sum;
}


//Log base 2
double PlatformSupport::log_2(double x)
{ return(log(x) / LOG_2);}


//Destructor
PlatformSupport::~PlatformSupport()
{
	int i, j;

	if(markov!=NULL && charMap!=NULL){
		for(i=1; i<=MAX_MARKOV; i++){
			for(j=0;j<pow(B,i);j++) 
			{	free(charMap[i][j]); }
			free(charMap[i]);
			free(markov[i]);
		}
		free(charMap);
		free(markov);
	}
	if(scoreDistMean!=NULL){
		for(i=0; i<maxLen; i++) 
			free(scoreDistMean[i]);
		free(scoreDistMean);
	}
	if(scoreDistStdDev!=NULL){
		for(i=0; i<maxLen; i++) 
			free(scoreDistStdDev[i]);
		free(scoreDistStdDev);
	}
	if(pairwiseAlign!=NULL){
		for(i=0; i<matCount; i++)
			delete [] pairwiseAlign[i];
		delete [] pairwiseAlign;
	}
	for(i=0; i<matCount; i++)
		delete inputMotifs[i];
}
