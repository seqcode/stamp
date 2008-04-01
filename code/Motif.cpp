//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// Motif.cpp
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
#include "Motif.h"
#include "globals.h"
#include "ctype.h"

Motif::Motif(int l)
{
	int i,j;
	len=l;
	strcpy(famName, "None");

	//Motif
	f = new double* [l];
	for(i=0; i<l; i++)
	{	f[i] = new double[B];
		for(j=0; j<B; j++)
			f[i][j]=0;
	}
	//Count matrix
	n = new double* [l];
	for(i=0; i<l; i++)
	{	n[i] = new double[B];
		for(j=0; j<B; j++)
			n[i][j]=0;
	}
	//PWM
	pwm = new double* [l];
	for(i=0; i<l; i++)
	{	pwm[i] = new double[B];
		for(j=0; j<B; j++)
			pwm[i][j]=0;
	}
	weighting = 1;
	//Gaps are only called into use when constructing multiple alignments
	gaps = new double[l];
	for(i=0; i<l; i++)
		gaps[i]=0;
	members=1;
}

//Reset the motif
void Motif::Reset()
{	int i, j;
	for(i=0; i<len; i++)
		for(j=0; j<B; j++)
			f[i][j]=0;
	for(i=0; i<len; i++)
		for(j=0; j<B; j++)
			n[i][j]=0;
	for(i=0; i<len; i++)
		for(j=0; j<B; j++)
			pwm[i][j]=0;
		
	for(i=0; i<len; i++)
		gaps[i]=0;
	members=1;
}

//Reverse complement a motif
void Motif::RevCompMotif(Motif* out)
{
//	out->len = len;
	if(len == out->len){
		strcpy(out->name, name);
		strcpy(out->famName, famName);
		out->members = members;
		for(int i=0; i<len; i++)
		{
			out->f[(len-i)-1][0] = f[i][3]; out->n[(len-i)-1][0] = n[i][3]; out->pwm[(len-i)-1][0] = pwm[i][3]; 
			out->f[(len-i)-1][3] = f[i][0]; out->n[(len-i)-1][3] = n[i][0]; out->pwm[(len-i)-1][3] = pwm[i][0];
			out->f[(len-i)-1][1] = f[i][2]; out->n[(len-i)-1][1] = n[i][2]; out->pwm[(len-i)-1][1] = pwm[i][2];
			out->f[(len-i)-1][2] = f[i][1]; out->n[(len-i)-1][2] = n[i][1]; out->pwm[(len-i)-1][2] = pwm[i][1];
			out->gaps[(len-i)-1] = gaps[i];
		}
	}else{
		printf("error: lengths of motifs do not match!\n");
		exit(1);
	}
}

//Reverse complement a single column
void Motif::RevCompColumn(int i)
{
	double tmp_f, tmp_n, tmp_pwm;
	tmp_f=f[i][0]; tmp_n=n[i][0]; tmp_pwm=pwm[i][0];
	f[i][0] = f[i][3]; n[i][0] = n[i][3]; pwm[i][0] = pwm[i][3]; 
	f[i][3]=tmp_f; n[i][3]=tmp_n; pwm[i][3]=tmp_pwm;
	tmp_f=f[i][1]; tmp_n=n[i][1]; tmp_pwm=pwm[i][1];
	f[i][1] = f[i][2]; n[i][1] = n[i][2]; pwm[i][1] = pwm[i][2]; 
	f[i][2]=tmp_f; n[i][2]=tmp_n; pwm[i][2]=tmp_pwm;
}
//Clone a motif
void Motif::CopyMotif(Motif* nMot)
{
	strcpy(nMot->name, name);
	strcpy(nMot->famName, famName);
	nMot->members=members;
	for(int i=0; i<len; i++){
		for(int j=0; j<B; j++){
			nMot->n[i][j]=n[i][j];
			nMot->f[i][j]=f[i][j];
			nMot->pwm[i][j]=pwm[i][j];
		}
		nMot->gaps[i]=gaps[i];
	}
}

//Returns the consensus letter for this motif
char Motif::ColConsensus(int i)
{
	char val;
	char curr;
	char two_base_l[6]; //two base consensus
	double two_base_c[6];
	char three_base_l[4]; //three base consensus
	double three_base_c[4];
	double sum, p_max;
	int j, k;

	//Hard-coded consensus alphabet rules
	two_base_l[0]='Y';	two_base_l[1]='R';
	two_base_l[2]='W';	two_base_l[3]='S';
	two_base_l[4]='K';	two_base_l[5]='M';
	three_base_l[0]='V'; three_base_l[1]='H';
	three_base_l[2]='D'; three_base_l[3]='B';
	
	two_base_c[0]=f[i][1]+f[i][3];	two_base_c[1]=f[i][0]+f[i][2];
	two_base_c[2]=f[i][0]+f[i][3];	two_base_c[3]=f[i][1]+f[i][2];
	two_base_c[4]=f[i][2]+f[i][3];	two_base_c[5]=f[i][0]+f[i][1];
	three_base_c[0]=f[i][0]+f[i][1]+f[i][2];
	three_base_c[1]=f[i][0]+f[i][1]+f[i][3];
	three_base_c[2]=f[i][0]+f[i][2]+f[i][3];
	three_base_c[3]=f[i][1]+f[i][2]+f[i][3];

	sum=0;
	for(j=0; j<4; j++)
		sum+=f[i][j];

		
	if(f[i][0]/sum>=CONS1) {curr='A';}
	else if(f[i][1]/sum>=CONS1) {curr='C';}
	else if(f[i][2]/sum>=CONS1) {curr='G';}
	else if(f[i][3]/sum>=CONS1) {curr='T';}
	else {
		curr='N';
		p_max=CONS2;
		for(k=0;k<6;k++) {
			if(two_base_c[k]/sum>=p_max) {
				p_max=two_base_c[k];
				curr=two_base_l[k];
			}
		}
	}
	if(gaps[i]!=0)
		curr = tolower(curr);

	return(curr);
}

//Calculate the information content of a column
double Motif::Info(int i)
{
	int x;
	double sum=0;
	for(x=0;x<B;x++) {
		if(f[i][x]>0) {
			sum+=f[i][x]*log_2(f[i][x]);
		}
	}
	if(sum!=0)
		sum=sum*(-1);
	else
		sum=2;

return(2-sum);
}

//Print the motif in TRANSFAC format
void Motif::PrintMotif(FILE* out, bool famNames)
{
	int i, j;
	double w0, w1, w2, w3, wt;
	if(out==NULL){
		if(famNames)
			printf("DE\t%s_%s\n", famName, name);
		else
			printf("DE\t%s\n", name);
		for(i=0; i<len; i++){
			printf("%d\t", i);
			for(j=0; j<B; j++){
				printf("%.4lf\t", f[i][j]);
			}
			printf("%c\n", ColConsensus(i));
		}
		printf("XX\n");
	}else{	
		if(famNames)
			fprintf(out, "DE\t%s_%s\n", famName, name);
		else
			fprintf(out, "DE\t%s\n", name);
		for(i=0; i<len; i++){
			fprintf(out, "%d\t", i);
			for(j=0; j<B; j++){
				fprintf(out, "%.4lf\t", f[i][j]);
			}
			fprintf(out, "%c\n", ColConsensus(i));
		}
		fprintf(out, "XX\n");
	}
}

//Print the motif's consensus pattern
void Motif::PrintMotifConsensus()
{
	printf("\t%s consensus: ", name);
	for(int i=0; i<len; i++){
		printf("%c", ColConsensus(i));
	}printf("\n");
}

Motif::~Motif()
{
	int i;
	for(i=0; i<len; i++)
	{
		delete [] pwm[i];
		delete [] n[i];
		delete [] f[i];
	}
	delete [] f;
	delete [] n;
	delete [] pwm;
	delete [] gaps;
}

