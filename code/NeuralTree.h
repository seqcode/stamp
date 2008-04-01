//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// main.cpp
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


#ifndef NTREE_MARK
#define NTREE_MARK

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "globals.h"
#include "Motif.h"
#include "Alignment.h"
#include "PlatformSupport.h"
#include "MultipleAlignment.h"
#include "Tree.h"
#include <time.h>


//Neural tree general class
class NeuralTree : public Tree
{
protected:
	int numMotifs;
	MultipleAlignment* MAman;
	int t, total_t;
	double MAX_T;
	double CYCLE_MAX;
	double intSimThres;
	//Private Methods
	void InorderNameLeaves(TreeNode* n);//Name single member leaves
	void InorderReset(TreeNode* n); //Reset method
	void InorderFindNodeToSplit(TreeNode* n, double &lowestIntPSim, TreeNode* &lowSimNode);//Find a node to split on the basis of lowest internal pairwise similarity
	void InorderFindWinner(TreeNode* n, Motif* curr, TreeNode* &currWinner, int &mi1, int &mi2, bool &mforward1, bool &mforward2, double &currMaxScore, double &currMaxPVal);
	void InorderCalcIntSim(TreeNode* curr, double &numLeavesNonZero, double &lowestIntSim, TreeNode* &lowSimNode); //Find the node with lowest internal similarity
	void InorderCalcIntHomogeneity(TreeNode* curr, double& totalH);
	void InorderFindMostSimilarClusters(TreeNode* curr, double& highestSim);
	void InorderFindClusterNeighbour(TreeNode* subgraph,TreeNode* curr, double& highestSim); //helps the above
	void SplitNode(TreeNode* n); //Split the given node
	void PostorderPrune(TreeNode* n);//prune empty leaves
	void InorderAdjustModels(TreeNode* curr);
	double CalcAvgIntPairwise(TreeNode* n); //Calculate the average internal pairwise similarit
	double GetLearnRate();
public:
	//Constructor
	NeuralTree(Alignment* a, MultipleAlignment* ma):Tree(a){MAman=ma; intSimThres = 1; CYCLE_MAX=50; MAX_T = 10000;}

	//Initialise the tree (root only)
	void InitialiseTree(Motif** motifSet, int numMotifs);

	//Virtual building method
	virtual void BuildTree(PlatformSupport* p, bool treeTest=false)=0;
	virtual void LOOCVBuildTree(PlatformSupport* p, bool treeTest=true)=0;

	~NeuralTree(){}
};

//SOTA
class SOTA : public NeuralTree
{
private:
	double numLeavesNonZero;
	Motif** motifSet;
	AlignRec** pairwiseAlign;

	//Special homogeneity calculation for SOTA
	void InorderCalcIntHomogeneity2(TreeNode* curr, double& totalH, double& minErr, TreeNode* &minTN, double &numNodesCounted);
	void PreOrderBuildNodes(TreeNode* curr); //Train a node based on its parent's children

public:
	//Constructor
	SOTA(Alignment* a, MultipleAlignment* ma):NeuralTree(a, ma){}

	//Build the tree
	void BuildTree(PlatformSupport* p, bool treeTest=false);
	void LOOCVBuildTree(PlatformSupport* p, bool treeTest=true){}

	~SOTA(){}
};


//Top-down hierarchical clustering "neural" tree
class TopDownHClust : public NeuralTree
{
private:
	int numMotifs;
	double numLeavesNonZero;
	Motif** motifSet;
	AlignRec** pairwiseAlign;

	//Special homogeneity calculation for SOTA
	void BuildNodes(TreeNode* curr); //Train all nodes based on all inputs
	void InorderAdjustModels(TreeNode* curr); //Override the weighted version!
public:
	//Constructor
	TopDownHClust(Alignment* a, MultipleAlignment* ma):NeuralTree(a, ma){numLeaves=1; CYCLE_MAX=50; MAX_T = 100000;}

	//Build the tree
	void BuildTree(PlatformSupport* p, bool treeTest=false);
	void LOOCVBuildTree(PlatformSupport* p, bool treeTest=true){}

	~TopDownHClust(){}
};
#endif

