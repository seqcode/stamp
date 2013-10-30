//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// ProteinsDomains.cpp
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


#include "ProteinDomains.h"

//ProteinMotif constructor
ProteinMotif::ProteinMotif(int l)
{
	int i, j;

	len=l;
	f = new double*[len];
	for(i=0; i<l; i++)
	{	f[i] = new double[AA];
		for(j=0; j<AA; j++)
			f[i][j]=0;
	}
}

//Print the motif in TRANSFAC format
void ProteinMotif::PrintMotif()
{
	int i, j;
	printf("DE\t%s\n", name);
	for(i=0; i<len; i++){
		printf("%d\t", i);
		for(j=0; j<AA; j++){
			printf("%.4lf\t", f[i][j]);
		}printf("\t\t%lf\n", Info(i));
	}
	printf("XX\n");
}

//the information content of a column
double ProteinMotif::Info(int col)
{
	int x;
	double sum=0;
	for(x=0;x<AA;x++) {
		if(f[col][x]>0) {
			sum+=f[col][x]*log_2(f[col][x]);
		}
	}
	if(sum!=0)
		sum=sum*(-1);
	else
		sum=log_2(20);

	return(log_2(20)-sum);
}

//Protein Motif Destructor
ProteinMotif::~ProteinMotif()
{
	for(int i=0; i<len; i++)
	{
		delete [] f[i];
	}
	delete [] f;
}

//Read the protein alignment file (must be Pfam format!)
void ProteinDomains::ReadDomains(char* inFileName, Motif** inputMotifs, int numMotifs)
{
	int i,j,a;
	int lineCount=0;
	double currCount=0;
	char line[LONG_STR];
	int protAlignLen=0;
	char name[STR_LEN];
	char currMotifName[STR_LEN];
	char seq[LONG_STR];

	strcpy(inputFN, inFileName);
	numDomains = numMotifs;

	//Open the file
	FILE* in = fopen(inputFN, "r");
	if(in==NULL){perror("Cannot open protein domain file");exit(1);}

	//Count the number of motifs
	fgets(line, LONG_STR, in);
	while(!feof(in)){		
		if(strlen(line)>2){//if it's not a newline
			lineCount++;
			sscanf(line, "%s %s ", name, seq);
			protAlignLen = strlen(seq);
		}
		fgets(line, LONG_STR, in);
	}

	domainMotif = new ProteinMotif(protAlignLen);
	individualMotifs = new ProteinMotif*[numDomains];
	for(i=0; i<numDomains; i++){
		individualMotifs[i]=new ProteinMotif(protAlignLen);
	}
	//Read through again, this time extracting a domain motif for every PSSM in our binding motif set
	for(i=0; i<numMotifs; i++){
		strcpy(currMotifName, inputMotifs[i]->GetName());
		strcpy(individualMotifs[i]->name, currMotifName);
		currCount=0;
		
		fseek(in, 0, SEEK_SET);
		while(!feof(in)){		
			fgets(line, LONG_STR, in);
			if(strlen(line)>2){//if it's not a newline
				sscanf(line, "%s %s ", name, seq);
				if(strstr(name, currMotifName)!=NULL){
					currCount++;
					//Add to the individual motif
					protAlignLen = strlen(seq);
					for(j=0; j<protAlignLen; j++){
						if(char2num(seq[j])!=-1)
							individualMotifs[i]->f[j][char2num(seq[j])]++;
					}
				}
			}
		}
		if(currCount==0){
			printf("Error: %s not found in protein motif file... exiting!\n\n", currMotifName);
			exit(1);
		}else{
			for(j=0; j<protAlignLen; j++){
				for(a=0; a<AA; a++){
					individualMotifs[i]->f[j][a] = individualMotifs[i]->f[j][a]/currCount;
				}
			}
		}
	}
	//Read through once more, this time just constructing the overall alignment
	strcpy(domainMotif->name, "OverallDomain");
	fseek(in, 0, SEEK_SET);
	fgets(line, LONG_STR, in);
	while(!feof(in)){		
		sscanf(line, "%s %s ", name, seq);
		if(strlen(line)>2){//if it's not a newline
			//Add to the domain motif
			protAlignLen = strlen(seq);
			for(j=0; j<protAlignLen; j++){
				if(char2num(seq[j])!=-1)
					domainMotif->f[j][char2num(seq[j])]++;
			}
		}
		fgets(line, LONG_STR, in);
	}
	for(j=0; j<protAlignLen; j++){
		for(a=0; a<AA; a++){
			domainMotif->f[j][a] = domainMotif->f[j][a]/lineCount;
		}
	}
}

//Analyse the mutual information between alignments
void ProteinDomains::MutualInformation(MultiAlignRec* pssmAlignment, Motif* alignmentMotif, Motif** inputMotifs, int numMotifs)
{
	int i, j, a, b, p, n;
	int x = pssmAlignment->GetAlignL();
	int y = domainMotif->GetLen();
	double currTtl=0;
	double ttl=0;
	char posPrefName[STR_LEN];
	double mTtl;
	double RandM;
	int *rand_acids;
	double *ttl_acids= new double[AA];
	double *obs_acids= new double[AA];
	double **MIConf;
	double **M;
	double **Minfo;
	double **pairwise_ij;
	double log_2_20 = log_2(20);
	Motif* posPref = new Motif(20);
	
	//Set up pairwise_ij
	pairwise_ij=new double*[B];
	for(b=0; b<B; b++){
		pairwise_ij[b]=new double[AA];
		for(a=0; a<AA; a++)
			pairwise_ij[b][a]=0;
	}
	
	//set up M, Minfo, & MIConf
	M = new double*[x];
	Minfo = new double*[x];
	MIConf = new double*[x];
	for(i=0; i<x; i++){
		M[i] = new double [y];
		Minfo[i] = new double [y];
		MIConf[i] = new double [y];
		for(j=0; j<y; j++){
			M[i][j]=0;
			Minfo[i][j]=0;
			MIConf[i][j]=0;
		}
	}

    //Fill in the M values
	for(i=0; i<x; i++){
		for(j=0; j<y; j++){

			//Reset the pairwise frequencies
			for(b=0; b<B; b++){
				for(a=0; a<AA; a++)
					pairwise_ij[b][a]=0;
			}
			//Calculate pairwise frequencies for these values of i & j
			currTtl=0;
			for(b=0; b<B; b++){
				for(a=0; a<AA; a++){
					//go through each pair of PSSM - domain
					for(p=0; p<pssmAlignment->GetNumAligned(); p++){
						if(pssmAlignment->profileAlignment[p]->f[i][b]>0){
							pairwise_ij[b][a] += pssmAlignment->profileAlignment[p]->f[i][b] * individualMotifs[pssmAlignment->alignedIDs[p]]->f[j][a];//printf("%s\t%s\n", pssmAlignment->profileAlignment[p]->GetName(), individualMotifs[pssmAlignment->alignedIDs[p]]->name);//
						}else{
							pairwise_ij[b][a] +=0.25* individualMotifs[pssmAlignment->alignedIDs[p]]->f[j][a];
						}
					}
					currTtl +=pairwise_ij[b][a];
				}
			}
			//normalise
			for(a=0; a<AA; a++){
				ttl=0;
				for(b=0; b<B; b++){
					pairwise_ij[b][a] = pairwise_ij[b][a]/((double)pssmAlignment->GetNumAligned());//printf("%.4lf\t",pairwise_ij[b][a]);
					ttl+=pairwise_ij[b][a];
				}
				for(b=0; b<B; b++){
					if(ttl==0)
						posPref->f[a][b] =0.25;
					else
						posPref->f[a][b] = pairwise_ij[b][a]/ttl;
					sprintf(posPrefName, "DNA_%d_Protein_%d", i,j);
					strcpy(posPref->name, posPrefName);
				}
			}

			//Calculate the actual M values
			mTtl=0;
			for(b=0; b<B; b++){
				for(a=0; a<AA; a++){
					if(pairwise_ij[b][a]>0 && alignmentMotif->f[i][b]>0 && domainMotif->f[j][a]>0)
					{	mTtl += pairwise_ij[b][a] * (log_2(pairwise_ij[b][a]/(alignmentMotif->f[i][b] * domainMotif->f[j][a])));
					}
				}
			}
			Minfo[i][j]=mTtl * (domainMotif->Info(j)/log_2_20);
			M[i][j]=mTtl;
		}		
	}

	//print out the values of M
	printf("MI\t");
	for(j=0; j<y; j++)
		printf("%d\t", j);
	printf("\n");
	for(i=0; i<x; i++){
		printf("%c\t", alignmentMotif->ColConsensus(i));
		for(j=0; j<y; j++){
			printf("%.4lf\t", M[i][j]);
		}
		printf("\n");
	}
	//print out the alignment motif
	alignmentMotif->PrintMotif();
	//print out the values of Minfo
/*	printf("\n\nMI/Info(p)\t");
	for(j=0; j<y; j++)
		printf("%d\t", j);
	printf("\n");
	for(i=0; i<x; i++){
		printf("%c\t", alignmentMotif->ColConsensus(i));
		for(j=0; j<y; j++){
			printf("%.4lf\t", Minfo[i][j]);
		}
		printf("\n");
	}
*/
/*
	//////////////////////////////////////////////////////////////////
	//This area is not completely verified!!!!!
	//Complete Randomization area
	rand_acids = new int[pssmAlignment->GetNumAligned()];
	RandM = 0;
	double totalObs=0;
	double GTObs=0;
	for(i=0; i<x; i++){
		for(j=0; j<y; j++){

			GTObs=0;
			for(n=0; n<RAND_MUTI_N; n++){
				//Reset 
				for(a=0; a<AA; a++)
				{	ttl_acids[a]=0; obs_acids[a]=0;}
				for(p=0; p<pssmAlignment->GetNumAligned(); p++)
					rand_acids[p]=0;
					
				//Count the number of distinct amino acids in the corresponding amino acid column
				int aaDistinct=0;
				for(a=0; a<AA; a++)
					if(domainMotif->f[j][a]>0)
						aaDistinct++; 
				
				totalObs=0;
				for(p=0; p<pssmAlignment->GetNumAligned(); p++){
					//populate observations
					for(a=0; a<AA; a++){
						obs_acids[a]+=individualMotifs[pssmAlignment->alignedIDs[p]]->f[j][a];
						totalObs+=individualMotifs[pssmAlignment->alignedIDs[p]]->f[j][a];
					}
				}
				//normalize
				for(a=0; a<AA; a++){
					obs_acids[a]=obs_acids[a]/totalObs;
				}//make probability distribution
				for(a=1; a<AA; a++){
					obs_acids[a]=obs_acids[a]+obs_acids[a-1];
				}
			
				for(p=0; p<pssmAlignment->GetNumAligned(); p++){
					//int dice = (int)floor((double)rand()/RAND_MAX*aaDistinct);
					double dice = ((double)rand()/RAND_MAX);
					int g=-1;
					for(a=0; a<AA; a++){
						if(dice<=obs_acids[a]){
							g=a; a=AA;
						}
					}
					//printf("%c\t%d\n", pssmAlignment->profileAlignment[p]->ColConsensus(i), g);
					ttl_acids[g]++;
					rand_acids[p]=g;
				}
				//normalise
				for(a=0; a<AA; a++)
					ttl_acids[a]=ttl_acids[a]/(double)pssmAlignment->GetNumAligned();
				//Reset the pairwise frequencies
				for(b=0; b<B; b++){
					for(a=0; a<AA; a++)
						pairwise_ij[b][a]=0;
				}//Calculate pairwise frequencies for the random pairs
				for(p=0; p<pssmAlignment->GetNumAligned(); p++){
					for(b=0; b<B; b++)
						pairwise_ij[b][rand_acids[p]] += pssmAlignment->profileAlignment[p]->f[i][b];
				}//normalise
				double ttl=0;
				for(a=0; a<AA; a++){
					for(b=0; b<B; b++){
						pairwise_ij[b][a] = pairwise_ij[b][a]/(double)pssmAlignment->GetNumAligned();
						ttl+=pairwise_ij[b][a];
					}
				}//Calculate the actual M values
				RandM=0;
				for(b=0; b<B; b++){
					for(a=0; a<AA; a++){
						if(pairwise_ij[b][a]>0 && alignmentMotif->f[i][b]>0 && ttl_acids[a]>0)
							RandM += pairwise_ij[b][a] * (log_2(pairwise_ij[b][a]/(alignmentMotif->f[i][b] * ttl_acids[a])));
					}
				}
				//totalRandM+=RandM;
				if(RandM>=M[i][j])
					GTObs++;
			}
			MIConf[i][j] = GTObs/(double)RAND_MUTI_N;
		}
	}
	//////////////////////////////////////////////////////////////////////////
*/
/*
	//////////////////////////////////////////////////////////////////
	//Random shuffling area
	rand_acids = new int[pssmAlignment->GetNumAligned()];
	double** residueShuffle = new double*[pssmAlignment->GetNumAligned()];
	for(p=0; p<pssmAlignment->GetNumAligned(); p++){
		residueShuffle[p] = new double[AA];
		for(a=0; a<AA; a++)
			residueShuffle[p][a] = 0;
	}
	int numRS = pssmAlignment->GetNumAligned();
	RandM = 0;
	double totalObs=0;
	double GTObs=0;
	for(i=0; i<x; i++){
		for(j=0; j<y; j++){

			GTObs=0;
			for(n=0; n<RAND_MUTI_N; n++){
				//Reset 
				for(a=0; a<AA; a++)
				{	ttl_acids[a]=0; obs_acids[a]=0;}
				for(p=0; p<pssmAlignment->GetNumAligned(); p++)
					rand_acids[p]=0;
					
				//Count the number of distinct amino acids in the corresponding amino acid column
				int aaDistinct=0;
				for(a=0; a<AA; a++)
					if(domainMotif->f[j][a]>0)
						aaDistinct++; 
				
				//Set up the shuffle 
				for(p=0; p<pssmAlignment->GetNumAligned(); p++){
					for(a=0; a<AA; a++)
					{	residueShuffle[p][a] = individualMotifs[pssmAlignment->alignedIDs[p]]->f[j][a];
						ttl_acids[a]+=individualMotifs[pssmAlignment->alignedIDs[p]]->f[j][a];
					}
				}numRS = pssmAlignment->GetNumAligned();

				//normalise
				for(a=0; a<AA; a++)
					ttl_acids[a]=ttl_acids[a]/(double)pssmAlignment->GetNumAligned();
				//Reset the pairwise frequencies
				for(b=0; b<B; b++){
					for(a=0; a<AA; a++)
						pairwise_ij[b][a]=0;
				}
				//Calculate pairwise frequencies 
				//Randomly pick one of the residue positions, and take the DNA motif in position p as its pair
				for(p=0; p<pssmAlignment->GetNumAligned(); p++){
					double dice = ((double)rand()/RAND_MAX);
					int i_dice = (int)floor(dice*numRS);
					for(a=0; a<AA; a++)
						for(b=0; b<B; b++)
							pairwise_ij[b][a] += pssmAlignment->profileAlignment[p]->f[i][b]* residueShuffle[i_dice][a];
					//printf("%d\t%d\t%d\tProtein %d paired with DNA %d\n", i,j,n,i_dice, p);
					//Delete the chosen residue from the shuffle
					for(int g=i_dice; g<numRS-1; g++)
						for(a=0; a<AA; a++)
							residueShuffle[g][a] =residueShuffle[g+1][a];
					numRS--;
				}//normalise
				double ttl=0;
				for(a=0; a<AA; a++){
					for(b=0; b<B; b++){
						pairwise_ij[b][a] = pairwise_ij[b][a]/(double)pssmAlignment->GetNumAligned();
						ttl+=pairwise_ij[b][a];
					}
				}//Calculate the actual M values
				RandM=0;
				for(b=0; b<B; b++){
					for(a=0; a<AA; a++){
						if(pairwise_ij[b][a]>0 && alignmentMotif->f[i][b]>0 && ttl_acids[a]>0)
							RandM += pairwise_ij[b][a] * (log_2(pairwise_ij[b][a]/(alignmentMotif->f[i][b] * ttl_acids[a])));
					}
				}
				//totalRandM+=RandM;
				if(RandM>=M[i][j])
					GTObs++;
			}
			MIConf[i][j] = GTObs/(double)RAND_MUTI_N;
		}
	}

	
	///////////////////////////////////////////////////////////////////
	//print out the probability scores
	printf("Probability of observing the above MI values\n\t");
	for(j=0; j<y; j++)
		printf("%d\t", j);
	printf("\n");
	for(i=0; i<x; i++){
		printf("%c\t", alignmentMotif->ColConsensus(i));
		for(j=0; j<y; j++){
			printf("%.8lf\t", MIConf[i][j]);
		}
		printf("\n");
	}
	for(p=0; p<pssmAlignment->GetNumAligned(); p++)
		delete [] residueShuffle[p];
	delete residueShuffle;
	delete rand_acids;
	//////////////////////////////////////////////////////////////////
*/
	

	//Memory cleanup
	for(b=0; b<B; b++)
		delete pairwise_ij[b];
	delete pairwise_ij;
	for(i=0; i<x; i++)
		delete M[i];
	delete M;
	for(i=0; i<x; i++)
		delete Minfo[i];
	for(i=0; i<x; i++)
		delete MIConf[i];
	delete Minfo;
	delete MIConf;
	delete ttl_acids;
	delete obs_acids;
	delete posPref;
}

//Converts a single amino acid into it's integer (0 to 20)
int ProteinDomains::char2num(char x) {
   	int b;
	b=tolower(x);
	
	if(b=='a')
		return(0);
	else if(b=='r')
		return(1);
	else if(b=='n')
		return(2);
	else if(b=='d')
		return(3);
	else if(b=='c')
		return(4);
	else if(b=='e')
		return(5);
	else if(b=='q')
		return(6);
	else if(b=='g')
		return(7);
	else if(b=='h')
		return(8);
	else if(b=='i')
		return(9);
	else if(b=='l')
		return(10);
	else if(b=='k')
		return(11);
	else if(b=='m')
		return(12);
	else if(b=='f')
		return(13);
	else if(b=='p')
		return(14);
	else if(b=='s')
		return(15);
	else if(b=='t')
		return(16);
	else if(b=='w')
		return(17);
	else if(b=='y')
		return(18);
	else if(b=='v')
		return(19);

  return -1;
}

//Destructor
ProteinDomains::~ProteinDomains()
{
	if(domainMotif!=NULL){
		delete domainMotif;
	}
	if(individualMotifs!=NULL){
		for(int i=0; i<numDomains; i++){
			delete individualMotifs[i];
		}delete individualMotifs;
	}
	
}
