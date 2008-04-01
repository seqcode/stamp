//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// NeuralTree.cpp
//
// Started: 14th Feb 2006
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


#include "NeuralTree.h"

// *********************************************************************************** //
//Train 2 nodes based on their parent's children
void SOTA::PreOrderBuildNodes(TreeNode* curr)
{
	int j;
	Child* c; 
	//Start with a node... split it if there are more than one children in the current parent
	if(curr->members==2){
		SplitNode(curr);
		if(curr->left->members>0 && curr->right->members>0)
			numLeavesNonZero++;
		if(!treeTesting)
		{//	printf("\nLeaves: %d, NZLeaves: %.0lf, Split: %d, LeftAfterSplit: %did %dm, RightAfterSplit: %did %dm\n", numLeaves, numLeavesNonZero, curr->nodeID, curr->left->nodeID, curr->left->members, curr->right->nodeID, curr->right->members);
		//	curr->left->profile->PrintMotifConsensus();
		//	curr->right->profile->PrintMotifConsensus();
		}
		//Recursion
		PreOrderBuildNodes(curr->left);
		PreOrderBuildNodes(curr->right);
	}else if(curr->members>1 && CalcAvgIntPairwise(curr)<intSimThres){
		SplitNode(curr);
        //Parent now split... train the new leaves
		int z,b;
		double winningScore=0, winningPVal=0, lowestIntSim, lastNLNZ=0;
		TreeNode* winner=NULL;
		TreeNode* lowSimNode=NULL;
		char tmpName[STR_LEN];
		int mi1, mi2; double pS; bool mforward1, mforward2;

		t=0;
		do{
			//Reset the nodes
			InorderReset(curr);
			//Find & update winners
			for(c=curr->progeny; c!=NULL; c=c->next)
			{
				winningScore=-100000; winningPVal=-100000; winner=NULL;
				InorderFindWinner(curr, motifSet[c->mID], winner, mi1, mi2, mforward1, mforward2, winningScore, winningPVal);
				//add the motif to the winning node
				if(winner->members==0){
					if(winner->alignment!=NULL)
						delete winner->alignment;
					winner->alignment = new MultiAlignRec(1, motifSet[c->mID]->GetLen());
					strcpy(winner->alignment->alignedNames[0], motifSet[c->mID]->name);
					strcpy(winner->alignment->profileAlignment[0]->name, motifSet[c->mID]->name);
					winner->alignment->alignedIDs[0] = c->mID; 
					winner->members=1;
					winner->avgPval=winningPVal;
					//initialise the alignment
					for(z=0; z<motifSet[c->mID]->GetLen(); z++)
						for(b=0; b<B; b++)
							winner->alignment->profileAlignment[0]->f[z][b]=motifSet[c->mID]->f[z][b];
				}else{
					//Add a motif to an existing alignment
					winner->alignment = MAman->SingleProfileAddition(winner->alignment, Plat->inputMotifs[c->mID], c->mID);
					winner->members++;
					winner->avgPval = (winner->avgPval*(((double)winner->members-1)/(double)winner->members))+(winningPVal*(1/(double)winner->members));
				}
			}
			//Adjust the models (Neighbourhood update)
			InorderAdjustModels(curr);
			t++;
			total_t++;	
		}while(t<CYCLE_MAX && total_t<MAX_T);
		
		//Add the children to each leaf
		for(j=0; j<curr->left->members; j++){
			Child* tmp=new Child();
			tmp->next = curr->left->progeny;
			tmp->m=motifSet[curr->left->alignment->alignedIDs[j]];
			tmp->mID=curr->left->alignment->alignedIDs[j];
			curr->left->progeny = tmp;
		}for(j=0; j<curr->right->members; j++){
			Child* tmp=new Child();
			tmp->next = curr->right->progeny;
			tmp->m=motifSet[curr->right->alignment->alignedIDs[j]];
			tmp->mID=curr->right->alignment->alignedIDs[j];
			curr->right->progeny = tmp;
		}

		if(curr->left->members>0 && curr->right->members>0)
			numLeavesNonZero++;

		if(!treeTesting)
		{//	printf("\nLeaves: %d, NZLeaves: %.0lf, Split: %d, LeftAfterSplit: %did %dm, RightAfterSplit: %did %dm\n", numLeaves, numLeavesNonZero, curr->nodeID, curr->left->nodeID, curr->left->members, curr->right->nodeID, curr->right->members);
		//	curr->left->profile->PrintMotifConsensus();
		//	curr->right->profile->PrintMotifConsensus();
		}

		//Recursion
		PreOrderBuildNodes(curr->left);
		PreOrderBuildNodes(curr->right);
	}
}

//SOTA's tree building method
void SOTA::BuildTree(PlatformSupport* p, bool treeTest)
{
	Plat = p;
	treeTesting=treeTest;
	numMotifs = Plat->GetMatCount();
	motifSet = Plat->inputMotifs; 
	pairwiseAlign = Plat->pairwiseAlign;
	numLeavesNonZero=1;

	InitialiseTree(motifSet, numMotifs);

	PreOrderBuildNodes(root);	

	//Prune Here
	PostorderPrune(root);

	//Name the leaves
	InorderNameLeaves(root);

	//test the homogeneity of each level in the tree
	if(treeTesting){
		double totalH, minID=1, minErr=0, numNodesCounted=10000;
		TreeNode* minTN;
		while(numNodesCounted>2){
			totalH=0;
			numNodesCounted=0;
			minErr=0;
			InorderCalcIntHomogeneity2(root,totalH, minErr,minTN, numNodesCounted);
			printf("%.0lf\t%lf\n", numNodesCounted, totalH/numNodesCounted);
			if(numNodesCounted>2)//Find the minID node and make it a leaf, its children nodes...
			{	minTN->leaf=true;
				minTN->left->leaf=false; minTN->right->leaf=false;
			}
		}
	}
}

//Private Method: Inorder resetting the tree
void NeuralTree::InorderReset(TreeNode* n)
{
	if(n->left != NULL) InorderReset(n->left);
	
	if(n->leaf){
		if(n->alignment!=NULL)
			delete n->alignment;
		n->alignment=NULL;
		n->members=0;
		KillChildren(n);
	}

	if(n->right != NULL) InorderReset(n->right);
}

//Inorder name the leaves
void NeuralTree::InorderNameLeaves(TreeNode* n)
{
	if(n->left != NULL) InorderNameLeaves(n->left);
	
	if(n->leaf){
		if(n->alignment!=NULL && n->alignment->GetNumAligned()==1){
            strcpy(n->profile->name, n->alignment->alignedNames[0]);
		}
	}

	if(n->right != NULL) InorderNameLeaves(n->right);
}

//Inorder find the winning node
void NeuralTree::InorderFindWinner(TreeNode* n, Motif* curr, TreeNode* &currWinner, int &mi1, int &mi2, bool &mforward1, bool &mforward2, double &currMaxScore, double &currMaxPVal)
{
	double currScore, aScore;
	int i1, i2, aL, maL;
	bool forward1, forward2;

	if(n->left != NULL) InorderFindWinner(n->left, curr, currWinner, mi1, mi2, forward1, forward2, currMaxScore, currMaxPVal);
	if(n->leaf){
		aScore = Aman->AlignMotifs2D(curr, n->profile, i1, i2, aL, forward1, forward2);
		currScore = Plat->Score2ZScore(curr->len,n->profile->len, aScore);//printf("nID:%d s: %lf\n",n->nodeID, currScore);curr->PrintMotifConsensus(); n->profile->PrintMotifConsensus();
		if(currScore>currMaxScore)
		{
			mi1=i1; mi2=i2; maL=aL;
			mforward1=forward1; mforward2=forward2;
			currWinner = n;
			currMaxScore=currScore;
			currMaxPVal = Plat->Score2PVal(curr->len,n->profile->len,aScore);
		}
	}
	if(n->right != NULL) InorderFindWinner(n->right, curr, currWinner, mi1, mi2, forward1, forward2, currMaxScore, currMaxPVal);
}

//Inorder calculation of internal similarity
void NeuralTree::InorderCalcIntSim(TreeNode* curr, double &numLeavesNonZero, double &lowestIntSim, TreeNode* &lowSimNode)
{
	if(curr->left != NULL){ InorderCalcIntSim(curr->left, numLeavesNonZero, lowestIntSim, lowSimNode);}
	if(curr->leaf)
	{
		if(curr->members>0)
			numLeavesNonZero+=1;

		if(curr->members>1){
			if(curr->avgPval<=lowestIntSim){
				lowestIntSim=curr->avgPval;
				lowSimNode = curr;
			}
		}
	}
	if(curr->right != NULL){ InorderCalcIntSim(curr->right, numLeavesNonZero, lowestIntSim, lowSimNode);}
}
//Find a node to split on the basis of lowest internal pairwise similarity
void NeuralTree::InorderFindNodeToSplit(TreeNode* curr, double &lowestIntPSim, TreeNode* &lowSimNode)
{
	if(curr->left != NULL){ InorderFindNodeToSplit(curr->left, lowestIntPSim, lowSimNode);}
	if(curr->leaf)
	{	printf("%d(%d)\t", curr->members, curr->nodeID);
		if(curr->members>1){
			double currIntSim = CalcAvgIntPairwise(curr);
			if(currIntSim <lowestIntPSim){
				lowestIntPSim = currIntSim;
				lowSimNode=curr;
			}
		}
	}
	if(curr->right != NULL){ InorderFindNodeToSplit(curr->right, lowestIntPSim, lowSimNode);}
}

//Find the closest cluster center distance
void NeuralTree::InorderFindMostSimilarClusters(TreeNode* curr, double& highestSim)
{
	if(curr->left != NULL){ InorderFindMostSimilarClusters(curr->left, highestSim);}
	if(curr->leaf)
	{	
		if(curr->members>1){
			double currSim=0; 
			InorderFindClusterNeighbour(root, curr, currSim);
			if(currSim >highestSim){
				highestSim=currSim;
			}
		}
	}
	if(curr->right != NULL){ InorderFindMostSimilarClusters(curr->right, highestSim);}
}
//Find the neighbour in a subgraph to a given node (supports the above)
void NeuralTree::InorderFindClusterNeighbour(TreeNode* subgraph,TreeNode* curr, double& highestSim)
{	int i1, i2, aL; bool forward1, forward2;

	if(subgraph->left != NULL){ InorderFindClusterNeighbour(subgraph->left, curr, highestSim);}
	if(subgraph->leaf)
	{	
		if(subgraph->members>1 && curr->nodeID!=subgraph->nodeID){
			double aScore = Aman->AlignMotifs2D(curr->profile, subgraph->profile, i1, i2, aL, forward1, forward2);
			double currScore = Plat->Score2PVal(curr->profile->len,subgraph->profile->len, aScore);
			if(currScore>highestSim){
				highestSim=currScore;
			}
		}
	}
	if(subgraph->right != NULL){ InorderFindClusterNeighbour(subgraph->right, curr, highestSim);}
}

//Calculate the average internal pairwise similarity
double NeuralTree::CalcAvgIntPairwise(TreeNode* n)
{
	Child* c; Child* d;
	double totalAvgPairwise=0;
	double currAvgPairwise;
	for(c=n->progeny; c!=NULL; c=c->next){
		currAvgPairwise=0;
		for(d=n->progeny; d!=NULL; d=d->next){
			if(d->mID==c->mID){
				currAvgPairwise+=1;
			}else{
				currAvgPairwise+=Plat->pairwiseAlign[c->mID][d->mID].p_value;
			}
		}
		currAvgPairwise = currAvgPairwise/(double)n->members;
		totalAvgPairwise += currAvgPairwise;
	}
	totalAvgPairwise = totalAvgPairwise/(double)n->members;
	return(totalAvgPairwise);
}

//Inorder calculation of internal homogeneity
void NeuralTree::InorderCalcIntHomogeneity(TreeNode* curr, double& totalH)
{
	Child* i;
	Child* j;
	if(curr->left != NULL){ InorderCalcIntHomogeneity(curr->left, totalH);}
	if(curr->leaf)
	{
		double currH=0;
		if(curr->members>0){
			if(curr->members==1){
				currH+=1;
			}else{
				for(i=curr->progeny; i!=NULL; i=i->next)
					for(j=curr->progeny; j!=NULL; j=j->next)
						if(strcmp(Plat->inputMotifs[i->mID]->famName, Plat->inputMotifs[j->mID]->famName)==0)
							currH++;
				currH=currH/((double)curr->members*(double)curr->members);
			}totalH+=currH;
		}
	}
	if(curr->right != NULL){  InorderCalcIntHomogeneity(curr->right, totalH);}
}


//Iterative inorder calculation of internal homogeneity
void SOTA::InorderCalcIntHomogeneity2(TreeNode* curr, double& totalH, double& minErr, TreeNode* &minTN, double &numNodesCounted)
{
	Child* i;
	Child* j;
	if(curr->left != NULL){ InorderCalcIntHomogeneity2(curr->left, totalH, minErr, minTN, numNodesCounted);}
	if(curr->leaf){
		double currH=0;
		if(curr->members>0){
			numNodesCounted++;
			if(curr->members==1){
				totalH+=1;
			}else{
				for(i=curr->progeny; i!=NULL; i=i->next)
					for(j=curr->progeny; j!=NULL; j=j->next)
						if(strcmp(Plat->inputMotifs[i->mID]->famName, Plat->inputMotifs[j->mID]->famName)==0)
							currH++;
				currH=currH/((double)curr->members*(double)curr->members);
				totalH+=currH;
			}
			if(curr->parent!=NULL && CalcAvgIntPairwise(curr->parent)>minErr){
				minErr = CalcAvgIntPairwise(curr->parent);
				minTN=curr->parent;
			}
		}
	}
	if(curr->right != NULL){  InorderCalcIntHomogeneity2(curr->right, totalH, minErr, minTN, numNodesCounted);}
}

//Adjust the profiles including neighbourhood interactions
void NeuralTree::InorderAdjustModels(TreeNode* curr)
{
	int z, b, l, x;
	double learnRate, tot;

	if(curr->left != NULL) InorderAdjustModels(curr->left);
	if(curr->leaf){
		char tmpName[STR_LEN];
					
		//Step 1: make a new alignment and copy in the last profile and the new alignment profile (if any)
		MultiAlignRec* tmpAlign = new MultiAlignRec(1, curr->profile->GetLen());
		strcpy(tmpAlign->alignedNames[0], "Temp0");
		strcpy(tmpAlign->profileAlignment[0]->name, "Temp0");
		tmpAlign->alignedIDs[0] = 0; 
		for(z=0; z<curr->profile->GetLen(); z++)
			for(b=0; b<B; b++)
				tmpAlign->profileAlignment[0]->f[z][b]=curr->profile->f[z][b];
		
		if(curr->members>0){
			for(x=0; x<curr->members; x++)
				tmpAlign = MAman->SingleProfileAddition(tmpAlign, Plat->inputMotifs[curr->alignment->alignedIDs[x]], 1);
		}
		if(curr->sibling!=NULL && curr->sibling->leaf && curr->sibling->members>0){
			for(x=0; x<curr->sibling->members; x++)
				tmpAlign = MAman->SingleProfileAddition(tmpAlign, Plat->inputMotifs[curr->sibling->alignment->alignedIDs[x]], 2);
		}

		//Make the new weighted profile
		Motif* newProfile = new Motif(tmpAlign->GetAlignL());
		newProfile->members=0;
		for(l=0; l<tmpAlign->GetNumAligned(); l++){
			learnRate=1;
			if(tmpAlign->alignedIDs[l]==1)
			{	learnRate = GetLearnRate();
			}
			else if(tmpAlign->alignedIDs[l]==2)
			{	learnRate = GetLearnRate();
				learnRate=learnRate/8;
			}
			else if(tmpAlign->alignedIDs[l]==0)
				learnRate=1;

			for(z=0; z<tmpAlign->GetAlignL(); z++){
				if(tmpAlign->profileAlignment[l]->f[z][0]!=-1){
					for(b=0; b<B; b++){
						newProfile->f[z][b] += tmpAlign->profileAlignment[l]->f[z][b] * learnRate;
					}
				}else{
					for(b=0; b<B; b++){
						newProfile->f[z][b] += 0.25 * learnRate;
					}newProfile->gaps[z]+=tmpAlign->profileAlignment[l]->gaps[z];
				}
			}
			newProfile->members++;
		}
		//Normalise
		for(z=0; z<tmpAlign->GetAlignL(); z++){
			tot=0;
			for(b=0; b<B; b++){
				tot+=newProfile->f[z][b];
			}for(b=0; b<B; b++){
				newProfile->f[z][b]=newProfile->f[z][b]/tot;
			}
		}	

		//Trim the edges of the current motif
		int c_start_offset=0, c_stop_offset=0;
		Motif* core_new = Aman->TrimEdges(newProfile, c_start_offset, c_stop_offset, 6, false);
		//Final step: update the node profile
		sprintf(tmpName, "Node%d", curr->nodeID);
		if(curr->profile!=NULL)
			delete curr->profile;
		curr->profile = new Motif((newProfile->GetLen()-c_stop_offset)-c_start_offset);
		strcpy(curr->profile->name, tmpName);
		l=0;
		for(z=c_start_offset; z<(newProfile->GetLen()-c_stop_offset); z++){
			for(b=0; b<B; b++){
				curr->profile->f[l][b]= newProfile->f[z][b];
			}curr->profile->gaps[l]=newProfile->gaps[z];
			l++;
		}Plat->f_to_n(curr->profile); Plat->n_to_pwm(curr->profile);
		delete core_new;
		delete newProfile;
		delete tmpAlign;
	}
	if(curr->right != NULL) InorderAdjustModels(curr->right);
}

//Initialise the tree (root only)
void NeuralTree::InitialiseTree(Motif** motifSet, int numMotifs)
{	int i;
	//Initialise the tree first (initialise the root alignment with iterative refinement?)
	root = new TreeNode();
	root->leaf=true;
	root->sibling=NULL;
	root->progeny=NULL;
	numNodes = 1;
	numLeaves=1;
	root->RandomInit();
	strcpy(root->profile->name, "Node0");
	Plat->f_to_n(root->profile); Plat->n_to_pwm(root->profile);
	root->nodeID=0;

	for(i=0; i<numMotifs; i++){
		Child* tmp=new Child();
		tmp->next = root->progeny;
		tmp->m=motifSet[i];
		tmp->mID=i;
		root->progeny = tmp;
	}
	root->members=numMotifs;

	//initialising alignment
	root->alignment = new MultiAlignRec(1, Plat->inputMotifs[0]->GetLen());
	strcpy(root->alignment->alignedNames[0], Plat->inputMotifs[0]->GetName());
	strcpy(root->alignment->profileAlignment[0]->name, Plat->inputMotifs[0]->GetName());
	root->alignment->alignedIDs[0] = 0; 
	for(int z=0; z<Plat->inputMotifs[0]->GetLen(); z++)
		for(int b=0; b<B; b++)
			root->alignment->profileAlignment[0]->f[z][b]=Plat->inputMotifs[0]->f[z][b];
	for(i=1; i<numMotifs; i++){
		root->alignment = MAman->SingleProfileAddition(root->alignment, Plat->inputMotifs[i], i);
	}
}

//Split the given leaf
void NeuralTree::SplitNode(TreeNode* n)
{
	char tmpName1[STR_LEN];char tmpName2[STR_LEN];
	double dice;
	int i, j, k, z, b;
	numLeaves++;
	numNodes+=2;
	n->leaf=false;
	n->left = new TreeNode();
	n->left->nodeID = numNodes-1;
	sprintf(tmpName1, "Node%d", n->left->nodeID);
	n->right = new TreeNode();
	n->right->nodeID = numNodes;
	sprintf(tmpName2, "Node%d", n->right->nodeID);
	n->left->parent = n;
	n->right->parent = n;
	n->left->sibling = n->right;
	n->right->sibling = n->left;
	n->left->leaf=true;
	n->right->leaf=true;
	n->left->members=0;
	n->right->members=0;
	double colTot;
	
	if(n->members==2){//Give it a helping hand...
		Child* C1 = n->progeny;
		Child* C2 = C1->next;
		n->left->profile = new Motif(Plat->inputMotifs[C1->mID]->GetLen());
		strcpy(n->left->profile->name, tmpName1);
		n->right->profile = new Motif(Plat->inputMotifs[C2->mID]->GetLen());
		strcpy(n->right->profile->name, tmpName2);	
		for(i=0; i<Plat->inputMotifs[C1->mID]->GetLen(); i++){
			for(j=0; j<B; j++){
				n->left->profile->f[i][j] = Plat->inputMotifs[C1->mID]->f[i][j];
			}
		}for(i=0; i<Plat->inputMotifs[C2->mID]->GetLen(); i++){
			for(j=0; j<B; j++){
				n->right->profile->f[i][j] = Plat->inputMotifs[C2->mID]->f[i][j];
			}
		}
		n->left->progeny=new Child(); n->right->progeny=new Child();
		n->left->progeny->m=Plat->inputMotifs[C1->mID]; n->left->progeny->mID=C1->mID; n->left->progeny->next=NULL;
		n->right->progeny->m=Plat->inputMotifs[C2->mID]; n->right->progeny->mID=C2->mID; n->right->progeny->next=NULL;
		n->left->members=1;
		n->right->members=1;
		strcpy(n->left->profile->name, Plat->inputMotifs[C1->mID]->GetName());
		strcpy(n->right->profile->name, Plat->inputMotifs[C2->mID]->GetName());
	}else{
		
		n->left->alignment = new MultiAlignRec(1, Plat->inputMotifs[n->alignment->alignedIDs[0]]->GetLen());
		strcpy(n->left->alignment->alignedNames[0], Plat->inputMotifs[n->alignment->alignedIDs[0]]->GetName());
		strcpy(n->left->alignment->profileAlignment[0]->name, Plat->inputMotifs[n->alignment->alignedIDs[0]]->GetName());
		n->left->alignment->alignedIDs[0] = n->alignment->alignedIDs[0]; 
		for(z=0; z<Plat->inputMotifs[n->alignment->alignedIDs[0]]->GetLen(); z++)
			for(b=0; b<B; b++)
				n->left->alignment->profileAlignment[0]->f[z][b]=Plat->inputMotifs[n->alignment->alignedIDs[0]]->f[z][b];
		n->right->alignment = new MultiAlignRec(1, Plat->inputMotifs[n->alignment->alignedIDs[1]]->GetLen());
		strcpy(n->right->alignment->alignedNames[0], Plat->inputMotifs[n->alignment->alignedIDs[1]]->GetName());
		strcpy(n->right->alignment->profileAlignment[0]->name, Plat->inputMotifs[n->alignment->alignedIDs[1]]->GetName());
		n->right->alignment->alignedIDs[0] = n->alignment->alignedIDs[1]; 
		for(z=0; z<Plat->inputMotifs[n->alignment->alignedIDs[1]]->GetLen(); z++)
			for(b=0; b<B; b++)
				n->right->alignment->profileAlignment[0]->f[z][b]=Plat->inputMotifs[n->alignment->alignedIDs[1]]->f[z][b];
		for(i=2; i<n->alignment->GetNumAligned(); i++){
			if(rand()%2==0){
				n->left->alignment = MAman->SingleProfileAddition(n->left->alignment, Plat->inputMotifs[n->alignment->alignedIDs[i]], n->alignment->alignedIDs[i]);
			}else if(i%2==1){
				n->right->alignment = MAman->SingleProfileAddition(n->right->alignment, Plat->inputMotifs[n->alignment->alignedIDs[i]], n->alignment->alignedIDs[i]);
			}
		}
		
		n->left->profile=MAman->Alignment2Profile(n->left->alignment, tmpName1);
		n->right->profile=MAman->Alignment2Profile(n->right->alignment, tmpName2);
		delete n->left->alignment; n->left->alignment=NULL;
		delete n->right->alignment; n->right->alignment=NULL;

		int c_start_offset=0, c_stop_offset=0;
		Motif* coreNew1 = Aman->TrimEdges(n->left->profile, c_start_offset, c_stop_offset, 6, false);
		if(n->left->profile!=NULL)
			delete n->left->profile;
		n->left->profile = coreNew1;
		strcpy(n->left->profile->name, tmpName1);
		Motif* coreNew2 = Aman->TrimEdges(n->right->profile, c_start_offset, c_stop_offset, 6, false);
		if(n->right->profile!=NULL)
			delete n->right->profile;
		n->right->profile = coreNew2;
		strcpy(n->right->profile->name, tmpName2);
	}
	Plat->f_to_n(n->left->profile); Plat->n_to_pwm(n->left->profile);
	Plat->f_to_n(n->right->profile); Plat->n_to_pwm(n->right->profile);
}

//Prune any loose leaves
void NeuralTree::PostorderPrune(TreeNode* n)
{
	int i, k;
	
	if(n->left != NULL) PostorderPrune(n->left);
	if(n->right != NULL) PostorderPrune(n->right);
	if(n->leaf && n->members==0){
		//Prune!
		if(n->sibling!=NULL){
			if(n->parent->profile!=NULL)
				delete n->parent->profile;
			n->parent->profile = new Motif(n->sibling->profile->GetLen());
			for(i=0; i<n->parent->profile->GetLen(); i++)
			{	for(k=0; k<B; k++){
					n->parent->profile->f[i][k] = n->sibling->profile->f[i][k];
				}
				n->parent->profile->gaps[i]=n->sibling->profile->gaps[i];
			}
			Plat->f_to_n(n->parent->profile); Plat->n_to_pwm(n->parent->profile);
			n->parent->leaf = n->sibling->leaf;
			n->parent->nodeID = n->sibling->nodeID;
			n->parent->avgPval = n->sibling->avgPval;
			strcpy(n->parent->profile->name, n->sibling->profile->name);
			n->parent->members = n->sibling->members;
			
			//copy alignment here
			if(n->parent->alignment!=NULL)
				delete n->parent->alignment;		
			n->parent->alignment = new MultiAlignRec(n->sibling->alignment->GetNumAligned(), n->sibling->alignment->GetAlignL());
			for(int x=0; x<n->sibling->alignment->GetNumAligned(); x++){
				strcpy(n->parent->alignment->alignedNames[x], n->sibling->alignment->alignedNames[x]);
				strcpy(n->parent->alignment->profileAlignment[x]->name, n->sibling->alignment->profileAlignment[x]->name);
				n->parent->alignment->alignedIDs[x] = n->sibling->alignment->alignedIDs[x]; 
				for(int y=0; y<n->sibling->alignment->GetAlignL(); y++)
					for(k=0; k<B; k++)
						n->parent->alignment->profileAlignment[x]->f[y][k]=n->sibling->alignment->profileAlignment[x]->f[y][k];
			}

			
			n->parent->left = n->sibling->left;
			n->parent->right = n->sibling->right;
			if(n->sibling->left!=NULL)
				n->sibling->left->parent = n->parent;
			if(n->sibling->right!=NULL)
				n->sibling->right->parent = n->parent;
			delete n->sibling;
		}else{
			n->parent->left=NULL;
			n->parent->right=NULL;
			n->parent->leaf=true;
			n->members=0;
		}
		//Delete this node
		delete n;
		numNodes -=2;
		numLeaves--;
	}
}

//Calculates the learning rate
double NeuralTree::GetLearnRate()
{
	//return((1-(t/CYCLE_MAX)));
	//return((0.25-(t/(4*CYCLE_MAX))));
	return(0.1);
}

//TopDownHClust's tree building method
void TopDownHClust::BuildTree(PlatformSupport* p, bool treeTest)
{
	Plat = p;
	treeTesting=treeTest;
	numMotifs = Plat->GetMatCount();
	motifSet = Plat->inputMotifs; 
	pairwiseAlign = Plat->pairwiseAlign;
	numLeavesNonZero=1;

	InitialiseTree(motifSet, numMotifs);

	BuildNodes(root);	

	//Prune Here
	PostorderPrune(root);

	//Name the leaves
	InorderNameLeaves(root);

	//test the homogeneity of each level in the tree
	if(treeTesting){
		double totalH, minID=1, minErr=0, numNodesCounted=10000;
		TreeNode* minTN;
		while(numNodesCounted>2){
			totalH=0;
			numNodesCounted=0;
			minErr=0;
			//InorderCalcIntHomogeneity(root,totalH, minErr,minTN, numNodesCounted);
			printf("%.0lf\t%lf\n", numNodesCounted, totalH/numNodesCounted);
			if(numNodesCounted>2)//Find the minID node and make it a leaf, its children nodes...
			{	minTN->leaf=true;
				minTN->left->leaf=false; minTN->right->leaf=false;
			}
		}
	}
}

//Train 2 nodes based on all input set
void TopDownHClust::BuildNodes(TreeNode* curr)
{
	int j;
	Child* c; 
	int z,b;
	double winningScore=0, winningPVal=0, lowestIntSim, lastNLNZ=0;
	TreeNode* winner=NULL;
	TreeNode* lowSimNode=NULL;
	char tmpName[STR_LEN];
	int mi1, mi2; double pS; bool mforward1, mforward2;
printf("Building TDHC\n");
	t=0;
	//Starts with a single node... split it 
	SplitNode(root);
	
	while(numLeaves<numMotifs){printf("***%d Leaves\n", numLeaves);
		t=0;
		//Do CYCLE_MAX times
		do{
			//Reset the nodes
			InorderReset(curr);
			//Assign input motifs to the most similar nodes
			for(int x=0; x<numMotifs; x++)
			{
				winningScore=-100000; winningPVal=-100000; winner=NULL;
				InorderFindWinner(root, motifSet[x], winner, mi1, mi2, mforward1, mforward2, winningScore, winningPVal);
				//add the motif to the winning node
				if(winner->members==0){
					if(winner->alignment!=NULL)
						delete winner->alignment;
					winner->alignment = new MultiAlignRec(1, motifSet[x]->GetLen());
					strcpy(winner->alignment->alignedNames[0], motifSet[x]->name);
					strcpy(winner->alignment->profileAlignment[0]->name, motifSet[x]->name);
					winner->alignment->alignedIDs[0] = x; 
					winner->members=1;
					winner->avgPval=winningPVal;
					//initialise the alignment
					for(z=0; z<motifSet[x]->GetLen(); z++)
						for(b=0; b<B; b++)
							winner->alignment->profileAlignment[0]->f[z][b]=motifSet[x]->f[z][b];
				}else{
					//Add a motif to an existing alignment
					winner->alignment = MAman->SingleProfileAddition(winner->alignment, Plat->inputMotifs[x], x);
					winner->members++;
					winner->avgPval = (winner->avgPval*(((double)winner->members-1)/(double)winner->members))+(winningPVal*(1/(double)winner->members));
				}
				Child* tmp=new Child();
				tmp->next = winner->progeny;
				tmp->m=motifSet[x];
				tmp->mID=x;
				winner->progeny = tmp;
			}
			//Update nodes based on current contents
			InorderAdjustModels(root);
			t++;
			total_t++;	
		}while(t<CYCLE_MAX && total_t<MAX_T);
       
			
		//Calculate (& print) internal homogeneities
		numLeavesNonZero=0;lowestIntSim = 10000;
		InorderCalcIntSim(root, numLeavesNonZero, lowestIntSim, lowSimNode);
		printf("nonZero: %.0lf\tLowestIntSim: %lf\n", numLeavesNonZero, lowestIntSim);
		double totalH=0;
		InorderCalcIntHomogeneity(root, totalH); totalH=totalH/numLeavesNonZero;
		printf("Family-level Homogeneity: %lf\n", totalH);
		
		//Calculate (& print) inter-cluster distances
		double highestSim=0;
		InorderFindMostSimilarClusters(root, highestSim);
		printf("Maximum inter-cluster distance: %lf\n", highestSim);
		
		//Split the node with the lowest homogeneity
		TreeNode* node2Split=NULL;double lowestIntPSim =10000;printf("Nodes:\t");
		InorderFindNodeToSplit(root, lowestIntPSim, node2Split);
		printf("\nNode2Split: %d\tLowestIntPSim: %lf\n\n", node2Split->nodeID, lowestIntPSim);
		SplitNode(node2Split);

	}
  
}

//Adjust the profiles 
void TopDownHClust::InorderAdjustModels(TreeNode* curr)
{
	int z, b, l, x;
	double learnRate, tot;

	if(curr->left != NULL) InorderAdjustModels(curr->left);
	if(curr->leaf){
		char tmpName[STR_LEN];
					
		//Step 1: make a new alignment and copy in the last profile and the new alignment profile (if any)
		MultiAlignRec* tmpAlign = new MultiAlignRec(1, curr->profile->GetLen());//printf("Here%d_%d\n", tmpAlign->GetAlignL(),tmpAlign->GetNumAligned());
		strcpy(tmpAlign->alignedNames[0], "Temp0");
		strcpy(tmpAlign->profileAlignment[0]->name, "Temp0");
		tmpAlign->alignedIDs[0] = 0; 
		for(z=0; z<curr->profile->GetLen(); z++)
			for(b=0; b<B; b++)
				tmpAlign->profileAlignment[0]->f[z][b]=curr->profile->f[z][b];
		
		if(curr->members>0){
			for(x=0; x<curr->members; x++)
				tmpAlign = MAman->SingleProfileAddition(tmpAlign, Plat->inputMotifs[curr->alignment->alignedIDs[x]], 1);
		}
		
		//Make the new weighted profile
		Motif* newProfile = new Motif(tmpAlign->GetAlignL());
		newProfile->members=0;
		for(l=0; l<tmpAlign->GetNumAligned(); l++){
			learnRate=1;
			if(tmpAlign->alignedIDs[l]==1)
				learnRate = GetLearnRate();
			else if(tmpAlign->alignedIDs[l]==0)
				learnRate=1;

			for(z=0; z<tmpAlign->GetAlignL(); z++){
				if(tmpAlign->profileAlignment[l]->f[z][0]!=-1){
					for(b=0; b<B; b++){
						newProfile->f[z][b] += tmpAlign->profileAlignment[l]->f[z][b] * learnRate;
					}
				}else{
					for(b=0; b<B; b++){
						newProfile->f[z][b] += 0.25 * learnRate;
					}newProfile->gaps[z]+=tmpAlign->profileAlignment[l]->gaps[z];
				}
			}
			newProfile->members++;
		}

		//Normalise
		for(z=0; z<tmpAlign->GetAlignL(); z++){
			tot=0;
			for(b=0; b<B; b++){
				tot+=newProfile->f[z][b];
			}for(b=0; b<B; b++){
				newProfile->f[z][b]=newProfile->f[z][b]/tot;
			}
		}	

		//Trim the edges of the current motif
		int c_start_offset=0, c_stop_offset=0;
		Motif* core_new = Aman->TrimEdges(newProfile, c_start_offset, c_stop_offset, 6, false);

		//Final step: update the node profile
		sprintf(tmpName, "Node%d", curr->nodeID);
		if(curr->profile!=NULL)
			delete curr->profile;
		curr->profile = new Motif((newProfile->GetLen()-c_stop_offset)-c_start_offset);
		strcpy(curr->profile->name, tmpName);
		l=0;
		for(z=c_start_offset; z<(newProfile->GetLen()-c_stop_offset); z++){
			for(b=0; b<B; b++){
				curr->profile->f[l][b]= newProfile->f[z][b];
			}curr->profile->gaps[l]=newProfile->gaps[z];
			l++;
		}Plat->f_to_n(curr->profile); Plat->n_to_pwm(curr->profile);

		delete core_new;
		delete newProfile;
		delete tmpAlign;
	}
	if(curr->right != NULL) InorderAdjustModels(curr->right);
}

