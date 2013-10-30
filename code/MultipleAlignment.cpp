//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// MultipleAlignment.cpp
//
// Started: 16th January 2006
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


#include "MultipleAlignment.h"

//Convert a multiple alignment to a profile
Motif* MultipleAlignment::Alignment2Profile(MultiAlignRec* alignment, char* name)
{
	int z, b, x, i, j;
	double sum=0;
	Motif* newProfile;
	int alignL = alignment->GetAlignL();

	newProfile = new Motif(alignL);
	newProfile->members = alignment->GetNumAligned();
	strcpy(newProfile->name, name);
	for(z=0; z<alignL; z++){ 
		sum=0;
		for(x=0; x<alignment->GetNumAligned(); x++){
			if(alignment->profileAlignment[x]->f[z][0] == -1){
				for(b=0; b<B; b++){
					newProfile->f[z][b] += 0.25; //This bit is somewhat controversial... do we want a diluted signal in the gaps or a strong signal with a reduced gap penalty?
					sum+=0.25;
				}
				newProfile->gaps[z]+=1;
			}else{
				for(b=0; b<B; b++){
					newProfile->f[z][b] += alignment->profileAlignment[x]->f[z][b];
					sum+=alignment->profileAlignment[x]->f[z][b];
				}
			}			
		}
		for(b=0; b<B; b++)
		{	
			newProfile->f[z][b] = newProfile->f[z][b]/sum;
		}
	}

	Plat->f_to_n(newProfile);
	Plat->n_to_pwm(newProfile);
	return(newProfile);
}

//Convert a multiple alignment to a Sandelin & Wasserman FBP
Motif* MultipleAlignment::Alignment2SWFBP(MultiAlignRec* alignment, char* name)
{
	int z, b, x, y, i, j;
	double sum=0;
	Motif* newProfile;
	int alignL = alignment->GetAlignL();
	newProfile = new Motif(alignL);
	newProfile->members = alignment->GetNumAligned();
	//Set up weightings
	double* weightings = new double[(int)newProfile->members];
	for(x=0; x<alignment->GetNumAligned(); x++){double currW = 0;
		for(y=0; y<alignment->GetNumAligned(); y++){
			if(x!=y){
				currW += Plat->pairwiseAlign[alignment->alignedIDs[x]][alignment->alignedIDs[y]].p_value;
			}
		}
		currW=currW/alignment->GetNumAligned();
		weightings[x]=currW;
	}

	strcpy(newProfile->name, name);
	for(z=0; z<alignL; z++){ 
		sum=0;
		for(x=0; x<alignment->GetNumAligned(); x++){
			if(alignment->profileAlignment[x]->f[z][0] == -1){
				newProfile->gaps[z]+=1;
			}else{
				for(b=0; b<B; b++){
					newProfile->f[z][b] += alignment->profileAlignment[x]->f[z][b]*weightings[x];
					sum+=alignment->profileAlignment[x]->f[z][b]*weightings[x];
				}
			}			
		}
		for(b=0; b<B; b++)
		{	
			newProfile->f[z][b] = newProfile->f[z][b]/sum;
		}
	}
	double maxIC=0;
	double currIC=0;
	int startWin=0, stopWin=alignL-1;
	
	//scan either side of the alignment, deleting columns as necessary
	int mStart=0, mStop = alignL-1;
	bool run=true;
	for(i=0; i<mStop-IC_win_len && run; i++){
		if(newProfile->Info(i)<MIN_INFO	|| newProfile->gaps[i]>(double)alignment->GetNumAligned()/2){
			mStart++;
		}else{
			run=false;
		}
	}run=true;
	for(i=alignL-1; i>mStart+IC_win_len && run; i--){
		if(newProfile->Info(i)<MIN_INFO	|| newProfile->gaps[i]>(double)alignment->GetNumAligned()/2){
			mStop--;
		}else{
			run=false;
		}
	}
	if(mStart!=0 || mStop!=alignL-1){
		int nLen = (mStop-mStart)+1;
		Motif* newerProfile = new Motif(nLen);
		newerProfile->members = alignment->GetNumAligned();
		i=0;
		//delete columns in the motif
		for(j=mStart; j<=mStop; j++){
			for(b=0; b<B; b++){
				newerProfile->f[i][b]=newProfile->f[j][b];
			}
			newerProfile->gaps[i] = newProfile->gaps[j];
			i++;
		}
		delete newProfile;
		newProfile=newerProfile;

	}

	delete [] weightings;
	Plat->f_to_n(newProfile);
	Plat->n_to_pwm(newProfile);
	return(newProfile);
}

//Print the multiple alignment
void MultipleAlignment::PrintMultipleAlignmentConsensus(MultiAlignRec* alignment)
{
	if(alignment == NULL)
	{
		alignment = completeAlignment;
		if(alignment == NULL)
		{	printf("Error: complete alignment not yet constructed!\n\n");
			exit(1);
		}
	}

	int z; 
	int last;
	int aL = alignment->GetAlignL();

	if(aL>0){
		if(htmlOutput)
			printf("<center><font face=\"Courier New\"><table border=\"0\" width=\"700\">");
		for(int q=0; q<alignment->GetNumAligned(); q++){
			if(htmlOutput)
				printf("<tr>\n<td width=\"250\">%s:", alignment->alignedNames[q]);
			else
				printf("%s:\t", alignment->alignedNames[q]);
			
			if(htmlOutput)
				printf("</td>\n<td width=\"450\">");

			for(z=0; z<aL; z++){
				if(alignment->profileAlignment[q]->f[z][0]==-1)
					printf("-");
				else
					printf("%c", alignment->profileAlignment[q]->ColConsensus(z));
			}

			if(htmlOutput)
				printf("</td>\n</tr>");
			printf("\n");
		}
		printf("\n");
		if(htmlOutput)
			printf("</table></font></center>");
	
	}
}

//Handle pre-aligned input motifs
MultiAlignRec* MultipleAlignment::PreAlignedInput(PlatformSupport* p)
{
	Plat = p;

	int i,j, b, z, alignLen=0;
	double currTtl=0;

    MultiAlignRec* alignment;
	Motif* currProfile=NULL;
	int numMotifs = p->GetMatCount();
	//cycle through the motifs, checking that they are all the same length... exit otherwise
	alignLen = p->inputMotifs[0]->GetLen();
	for(i=0; i<numMotifs; i++){
		if(p->inputMotifs[i]->GetLen() != alignLen){
			printf("Error: motif %d is not the same length as the others\n", i);
			exit(1);
		}
	}
	alignment = new MultiAlignRec(numMotifs, alignLen);

	for(i=0; i<numMotifs; i++){
		strcpy(alignment->alignedNames[i], Plat->inputMotifs[i]->name);
		strcpy(alignment->profileAlignment[i]->name, Plat->inputMotifs[i]->name);
		alignment->alignedIDs[i] = i;
		//Fill initial alignment with sequence minA
		for(z=0; z<alignLen; z++)
			for(b=0; b<B; b++)
				alignment->profileAlignment[i]->f[z][b]=Plat->inputMotifs[i]->f[z][b];
	}

	currProfile = Alignment2Profile(alignment, "FBP");
	currProfile->PrintMotif();

	if(currProfile!=NULL)
		delete currProfile;
	
	return(alignment);
}


//Progressive Profile Multiple Alignment
MultiAlignRec* ProgressiveProfileAlignment::BuildAlignment(PlatformSupport* p, Alignment* a, Tree* curr_tree)
{
	//Import objects
	T = curr_tree;
	Plat = p;
	A_man = a;

	PostorderAlignment(T->root, T->root);    

	if(Plat->usingWeighting){
		WeightedFBP(T->root->alignment, T->root->profile);
	}
	//////////////////////////////////////////////////////////////////
	if(T->root->profile!=NULL)
		delete T->root->profile;
	T->root->profile = Alignment2Profile(T->root->alignment, "FBP");
	//////////////////////////////////////////////////////////////////
	PrintMultipleAlignmentConsensus(T->root->alignment);
	strcpy(T->root->profile->name, "FBP");
	char outFName[STR_LEN];
	sprintf(outFName, "%sFBP.txt", outName);
	FILE* out=fopen(outFName, "w");
	T->root->profile->PrintMotif(out);
	fclose(out);
	
	return(T->root->alignment);
}

//Postorder traversal of tree to make the alignments
void ProgressiveProfileAlignment::PostorderAlignment(TreeNode* n, TreeNode* start)
{
	int a, b, z, i1, i2, aL, last0, last1, antiZ;
	bool forward1, forward2; double score, sum;
	AlignRec* aH = new AlignRec();
	char tmpName[STR_LEN];
		

	if(n->left != NULL){PostorderAlignment(n->left, start);}
	if(n->right != NULL){PostorderAlignment(n->right, start);}
	if(n->leaf){
		//Profile already defined, make the alignment correspond to the profile (i.e. no gaps)
		if(n->alignment!=NULL)
			delete n->alignment;
		n->alignment = new MultiAlignRec(1, n->profile->GetLen());
		strcpy(n->alignment->alignedNames[0], n->profile->name);
		strcpy(n->alignment->profileAlignment[0]->name, n->profile->name);
		n->alignment->alignedIDs[0] = n->leafID; 
		//Fill alignSection
		for(z=0; z<n->profile->GetLen(); z++)
			for(b=0; b<B; b++)
				n->alignment->profileAlignment[0]->f[z][b]=n->profile->f[z][b];
	}
	
	if(!n->leaf)
	{
		Motif* revOne = new Motif(n->left->profile->GetLen());
		n->left->profile->RevCompMotif(revOne);
		Motif* revTwo = new Motif(n->right->profile->GetLen());
		n->right->profile->RevCompMotif(revTwo);
		Motif* curr1;	Motif* curr2;

		n->members = n->left->members + n->right->members;
		score = A_man->AlignMotifs2D(n->left->profile, n->right->profile, i1, i2, aL, forward1, forward2);
		if(forward1){curr1=n->left->profile;}
		else{curr1=revOne;}//printf("*R1*");}
		if(forward2){curr2=n->right->profile;}
		else{curr2 = revTwo;}//printf("*R2*");}
		
		//Align and copy the basic (pairwise) alignment to the place holder
		if(n->alignment!=NULL)
			delete n->alignment;
		n->alignment = new MultiAlignRec(n->members, aL);
		aH->CopyAlignSec(A_man->alignSection, aL); 
		
		//Using the pairwise alignment placeholder, construct the alignment
		for(b=0; b<n->left->alignment->GetNumAligned(); b++){
			strcpy(n->alignment->alignedNames[b], n->left->alignment->alignedNames[b]);
			strcpy(n->alignment->profileAlignment[b]->name,n->left->alignment->alignedNames[b]);
			n->alignment->alignedIDs[b] = n->left->alignment->alignedIDs[b];
		}for(b=0; b<n->right->alignment->GetNumAligned(); b++){
			strcpy(n->alignment->alignedNames[b+n->left->alignment->GetNumAligned()], n->right->alignment->alignedNames[b]);
			strcpy(n->alignment->profileAlignment[b+n->left->alignment->GetNumAligned()]->name, n->right->alignment->alignedNames[b]);
			n->alignment->alignedIDs[b+n->left->alignment->GetNumAligned()] = n->right->alignment->alignedIDs[b];
		}
		last0=-50; last1=-50;
		antiZ=0;
		for(z=aL-1; z>=0; z--){ 
			if(aH->alignSection[1][z]==last1 || aH->alignSection[1][z]==-1){
				//Gap in alignment 1; add in alignment 0's column only
				for(a=0; a<n->left->alignment->GetNumAligned(); a++){
					for(b=0; b<B; b++){
						if(forward1)
							n->alignment->profileAlignment[a]->f[antiZ][b]=n->left->alignment->profileAlignment[a]->f[aH->alignSection[0][z]][b];
						else
							n->alignment->profileAlignment[a]->f[antiZ][b]=n->left->alignment->profileAlignment[a]->f[n->left->alignment->GetAlignL()-aH->alignSection[0][z]-1][b];
					}
					if(!forward1)
						n->alignment->profileAlignment[a]->RevCompColumn(antiZ);
				}
				for(a=0; a<n->right->alignment->GetNumAligned(); a++)
					for(b=0; b<B; b++)
						n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->f[antiZ][b] = -1;

			}else if(aH->alignSection[0][z]==last0 || aH->alignSection[0][z]==-1){
				//Gap in alignment 0; add in alignment 1's column only
				for(a=0; a<n->left->alignment->GetNumAligned(); a++)
					for(b=0; b<B; b++)
						n->alignment->profileAlignment[a]->f[antiZ][b] = -1;
				for(a=0; a<n->right->alignment->GetNumAligned(); a++){
					for(b=0; b<B; b++){
						if(forward2)
							n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->f[antiZ][b]=n->right->alignment->profileAlignment[a]->f[aH->alignSection[1][z]][b];
						else
							n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->f[antiZ][b]=n->right->alignment->profileAlignment[a]->f[n->right->alignment->GetAlignL()-aH->alignSection[1][z]-1][b];
					}
					if(!forward2)
						n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->RevCompColumn(antiZ);
				}
			}else{
				//No gap; add in both alignments
				for(a=0; a<n->left->alignment->GetNumAligned(); a++){
					for(b=0; b<B; b++){
						if(forward1)
							n->alignment->profileAlignment[a]->f[antiZ][b]=n->left->alignment->profileAlignment[a]->f[aH->alignSection[0][z]][b];
						else
							n->alignment->profileAlignment[a]->f[antiZ][b]=n->left->alignment->profileAlignment[a]->f[n->left->alignment->GetAlignL()-aH->alignSection[0][z]-1][b];
					}
					if(!forward1)
						n->alignment->profileAlignment[a]->RevCompColumn(antiZ);
				}
				for(a=0; a<n->right->alignment->GetNumAligned(); a++){
					for(b=0; b<B; b++){
						if(forward2)
							n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->f[antiZ][b]=n->right->alignment->profileAlignment[a]->f[aH->alignSection[1][z]][b];
						else
							n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->f[antiZ][b]=n->right->alignment->profileAlignment[a]->f[n->right->alignment->GetAlignL()-aH->alignSection[1][z]-1][b];
					}
					if(!forward2)
						n->alignment->profileAlignment[a+n->left->alignment->GetNumAligned()]->RevCompColumn(antiZ);
				}
			}	
		
			last0 = aH->alignSection[0][z];
			last1 = aH->alignSection[1][z];
			antiZ++;
		}
		//Alignment constructed!

		//working from the multiple alignment, reconstruct the new profile
		sprintf(tmpName, "Internal_%d", n->nodeID);
		if(n->profile!=NULL)
			delete n->profile;
		n->profile = Alignment2Profile(n->alignment, tmpName);

		//Profile constructed!
		delete revOne;
		delete revTwo;
	}
	delete aH;	
}

//Iterative Refinement Multiple Alignment
MultiAlignRec* IterativeRefinementAlignment::BuildAlignment(PlatformSupport* p, Alignment* a, Tree* curr_tree)
{
	T = curr_tree;
	Plat = p;
	A_man = a;

	int i, j,x,b,z, minA, minB;
	int i1, i2, aL;
	bool forward1, forward2;
	double minDist = 1000000, currDist;
	int nM = Plat->GetMatCount();
	MultiAlignRec* alignment;
	Motif* currProfile=NULL;
	Motif* tmpProfile;
	int numAligned = 2;
	bool* processed = new bool[nM];
	for(i=0; i<nM; i++)
		processed[i]=false;

	//Step 1: Find the most similar pair
	for(i=0; i<nM; i++){
		for(j=0; j<nM; j++){
			if(i!=j){
				currDist = Plat->pairwiseAlign[i][j].dist;
				if(currDist < minDist){
					minDist = Plat->pairwiseAlign[i][j].dist;
					minA=i; minB=j;
	}	}	}	}

	//Step 1.2 initialise the alignment with the first motif
	alignment = new MultiAlignRec(1, Plat->inputMotifs[minA]->GetLen());
	strcpy(alignment->alignedNames[0], Plat->inputMotifs[minA]->name);
	strcpy(alignment->profileAlignment[0]->name, Plat->inputMotifs[minA]->name);
	alignment->alignedIDs[0] = minA;
	//Fill initial alignment with sequence minA
	for(z=0; z<Plat->inputMotifs[minA]->GetLen(); z++)
		for(b=0; b<B; b++)
			alignment->profileAlignment[0]->f[z][b]=Plat->inputMotifs[minA]->f[z][b];
	//Step 1.3: Align the first pair
	alignment = SingleProfileAddition(alignment, Plat->inputMotifs[minB], minB);
	if(currProfile!=NULL)
		delete currProfile;
	currProfile = Alignment2Profile(alignment, "current");
	processed[minA]=true; processed[minB]=true; 

	//Step 2: Add the other profiles into the current alignment
	for(x=0; x<nM-2; x++){
		//Find the most similar profile in the remaining motifs
		minDist = 1000000;
		for(i=0; i<nM; i++){
			if(!processed[i]){
				currDist = A_man->AlignMotifs2D(currProfile, Plat->inputMotifs[i], i1, i2, aL, forward1, forward2);
				if(currDist < minDist){
					minDist = currDist;
					minA=i;
		}	}	}
		//Add the lowest distance to the alignment
		alignment = SingleProfileAddition(alignment, Plat->inputMotifs[minA], minA);
		if(currProfile!=NULL)
			delete currProfile;
		currProfile = Alignment2Profile(alignment, "current");
		processed[minA]=true; 
	}

	//Step 3: Remove each motif from the alignment in turn, rebuild the multiple alignment and add in the motif again
	//Do this a fixed number of times
	for(x=0; x<IR_MA_ITER; x++){
		for(i=0; i<nM; i++){
			alignment = SingleProfileSubtraction(alignment, i);
			alignment = SingleProfileAddition(alignment, Plat->inputMotifs[i], i);
			if(currProfile!=NULL)
				delete currProfile;
			currProfile = Alignment2Profile(alignment, "current");
		}
	}

	//Weight the alignment if using weighting
	if(Plat->usingWeighting){
		WeightedFBP(alignment, currProfile);
	}

	//////////////////////////////////////////////////////////
	if(currProfile!=NULL)
		delete currProfile;
	currProfile = Alignment2SWFBP(alignment, "current");
	//////////////////////////////////////////////////////////

	//Print the resulting multiple alignment
	PrintMultipleAlignmentConsensus(alignment);
	
	strcpy(currProfile->name, "FBP");
	char outFName[STR_LEN];
	sprintf(outFName, "%sFBP.txt", outName);
	FILE* out=fopen(outFName, "w");
	currProfile->PrintMotif(out);
	fclose(out);

	if(currProfile!=NULL)
		delete currProfile;

	return(alignment);
}

//Align a single motif to an existing alignment
MultiAlignRec* MultipleAlignment::SingleProfileAddition(MultiAlignRec* alignment, Motif* two, int twoID)
{
	int i1, i2, aL, last0, last1, antiZ, a, b, z;
	bool forward1, forward2; double score, sum;
	AlignRec* aH = new AlignRec();
	char tmpName[STR_LEN];
	Motif* one =NULL;
	MultiAlignRec* newAlignment;

	sprintf(tmpName, "Aligned_%d", alignment->GetNumAligned()+1);
	one = Alignment2Profile(alignment, "tmpName");
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* revTwo = new Motif(two->GetLen());
	two->RevCompMotif(revTwo);
	Motif* curr1;	Motif* curr2;
	score = A_man->AlignMotifs2D(one, two, i1, i2, aL, forward1, forward2);
	if(forward1){curr1=one;}
	else{curr1=revOne;}
	if(forward2){curr2=two;}
	else{curr2 = revTwo;}
	//Align and copy the basic (pairwise) alignment to the place holder
	newAlignment = new MultiAlignRec(alignment->GetNumAligned()+1, aL);
	aH->CopyAlignSec(A_man->alignSection, aL); 


	//Using the pairwise alignment placeholder, construct the alignment
	for(b=0; b<alignment->GetNumAligned(); b++){
		strcpy(newAlignment->alignedNames[b], alignment->alignedNames[b]);
		strcpy(newAlignment->profileAlignment[b]->name, alignment->alignedNames[b]);
		newAlignment->alignedIDs[b] = alignment->alignedIDs[b];
	}
	strcpy(newAlignment->alignedNames[alignment->GetNumAligned()], two->name);
	strcpy(newAlignment->profileAlignment[alignment->GetNumAligned()]->name, two->name);
	newAlignment->alignedIDs[alignment->GetNumAligned()] = twoID;

	last0=-50; last1=-50;
	antiZ=0;
	for(z=aL-1; z>=0; z--){ 
		if(aH->alignSection[1][z]==last1 || aH->alignSection[1][z]==-1){
			//Gap in alignment 1; add in alignment 0's column only
			for(a=0; a<alignment->GetNumAligned(); a++){
				for(b=0; b<B; b++){
					if(forward1)
						newAlignment->profileAlignment[a]->f[antiZ][b] = alignment->profileAlignment[a]->f[aH->alignSection[0][z]][b];
					else
						newAlignment->profileAlignment[a]->f[antiZ][b] = alignment->profileAlignment[a]->f[alignment->GetAlignL() - aH->alignSection[0][z]-1][b];
				}
				if(!forward1)
					newAlignment->profileAlignment[a]->RevCompColumn(antiZ);
			}
			for(b=0; b<B; b++)
				newAlignment->profileAlignment[alignment->GetNumAligned()]->f[antiZ][b] = -1;

		}else if(aH->alignSection[0][z]==last0 || aH->alignSection[0][z]==-1){
			//Gap in alignment 0; add in alignment 1's column only
			for(a=0; a<alignment->GetNumAligned(); a++)
				for(b=0; b<B; b++)
					newAlignment->profileAlignment[a]->f[antiZ][b] = -1;
			for(b=0; b<B; b++){
				if(forward2)
					newAlignment->profileAlignment[alignment->GetNumAligned()]->f[antiZ][b] = two->f[aH->alignSection[1][z]][b];
				else
					newAlignment->profileAlignment[alignment->GetNumAligned()]->f[antiZ][b] = two->f[two->GetLen() - aH->alignSection[1][z]-1][b];
			}
			if(!forward2)
				newAlignment->profileAlignment[alignment->GetNumAligned()]->RevCompColumn(antiZ);

		}else{
			//No gap; add in both alignments
			for(a=0; a<alignment->GetNumAligned(); a++){
				for(b=0; b<B; b++){
					if(forward1)
						newAlignment->profileAlignment[a]->f[antiZ][b] = alignment->profileAlignment[a]->f[aH->alignSection[0][z]][b];
					else
						newAlignment->profileAlignment[a]->f[antiZ][b] = alignment->profileAlignment[a]->f[alignment->GetAlignL() - aH->alignSection[0][z]-1][b];
				}
				if(!forward1)
					newAlignment->profileAlignment[a]->RevCompColumn(antiZ);
			}
			for(b=0; b<B; b++){
				if(forward2)
					newAlignment->profileAlignment[alignment->GetNumAligned()]->f[antiZ][b] = two->f[aH->alignSection[1][z]][b];
				else
					newAlignment->profileAlignment[alignment->GetNumAligned()]->f[antiZ][b] = two->f[two->GetLen() - aH->alignSection[1][z]-1][b];
			}
			if(!forward2)
				newAlignment->profileAlignment[alignment->GetNumAligned()]->RevCompColumn(antiZ);
		}	
	
		last0 = aH->alignSection[0][z];
		last1 = aH->alignSection[1][z];
		antiZ++;
	}

	
	if(alignment!=NULL)
		delete alignment;
	delete one;
	delete revOne;
	delete revTwo;
	delete aH;

	return(newAlignment);
}

//Remove a single profile from an alignment
MultiAlignRec* MultipleAlignment::SingleProfileSubtraction(MultiAlignRec* alignment, int removeID)
{
	int i,j, a, b,z,newAL, gapCount;
	int removeRow=-1;
	int numBlankCol=0;
	MultiAlignRec* newAlignment;
	

	//First find the row to remove
	for(i=0; i<alignment->GetNumAligned(); i++){
		if(alignment->alignedIDs[i]==removeID){
			removeRow = i;
		}
	}if(removeRow==-1){
		printf("Error in Iterative Refinement Multiple Alignment: this profile is not in the current alignment\n");
		exit(1);
	}
	//Count the columns that have only gaps in non-removeRow positions
	for(j=0; j<alignment->GetAlignL(); j++){
		gapCount=0;
		for(i=0; i<alignment->GetNumAligned(); i++){
			if(i!=removeRow && alignment->profileAlignment[i]->f[j][0] == -1)
				gapCount++;
		}
		if(gapCount == alignment->GetNumAligned()-1)
			numBlankCol++;
	}
	//declare the new alignment
	newAL = alignment->GetAlignL()-numBlankCol;
	newAlignment = new MultiAlignRec(alignment->GetNumAligned()-1, newAL);

	//Copy the relevant rows and columns into the new alignment
	a=0;
	for(i=0; i<alignment->GetNumAligned(); i++){ //Names & IDs first
		if(i!=removeRow){
			strcpy(newAlignment->alignedNames[a], alignment->alignedNames[i]);
			strcpy(newAlignment->profileAlignment[a]->name, alignment->alignedNames[i]);
			newAlignment->alignedIDs[a] = alignment->alignedIDs[i];
			a++;
		}
	}
	//one column at a time now
	a=0; //a counts new rows
	z=0; //z counts new columns
	for(j=0; j<alignment->GetAlignL(); j++){
		//Is this an empty column?
		gapCount=0;
		a=0;
		for(i=0; i<alignment->GetNumAligned(); i++){
			if(i!=removeRow && alignment->profileAlignment[i]->f[j][0] == -1)
				gapCount++;
		}
		if(gapCount < alignment->GetNumAligned()-1){//Not an empty column, add the cells in this column
			for(i=0; i<alignment->GetNumAligned(); i++){
				if(i!=removeRow){
					for(b=0; b<B; b++){
						newAlignment->profileAlignment[a]->f[z][b] = alignment->profileAlignment[i]->f[j][b];
					}
					a++;
				}
			}
			z++;
		}
	}

	if(alignment!=NULL)
		delete alignment;
	return(newAlignment);
}

//This method converts a profile into a weighted FBP
void MultipleAlignment::WeightedFBP(MultiAlignRec* alignment, Motif* currProfile)
{
	int z, b, x, i, j;
	double sum=0;
	Motif* newProfile;
	int alignL = alignment->GetAlignL();
	
	currProfile->Reset();
	currProfile->members = alignment->GetNumAligned();
	for(z=0; z<alignL; z++){ 
		sum=0;
		for(x=0; x<alignment->GetNumAligned(); x++){
			if(alignment->profileAlignment[x]->f[z][0] == -1){
				for(b=0; b<B; b++){
					currProfile->f[z][b] += 0.25; //This bit is somewhat controversial... do we want a diluted signal in the gaps or a strong signal with a reduced gap penalty?
					sum+=0.25;
				}
				currProfile->gaps[z]+=1;
			}else{
				for(b=0; b<B; b++){
					currProfile->f[z][b] += alignment->profileAlignment[x]->f[z][b]*(Plat->inputMotifs[alignment->alignedIDs[x]]->weighting/Plat->GetTotalWeight());
					sum+=alignment->profileAlignment[x]->f[z][b]*(Plat->inputMotifs[alignment->alignedIDs[x]]->weighting/Plat->GetTotalWeight());
				}
			}			
		}
		for(b=0; b<B; b++)
		{	//printf("%lf\t%lf\n", newProfile->f[z][b], sum);
			currProfile->f[z][b] = currProfile->f[z][b]/sum;
		}
	}

    Plat->f_to_n(currProfile);
	Plat->n_to_pwm(currProfile);
}

