//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1
//
// Written By: Shaun Mahony
//
// Tree.h
//
// Started: 6th Dec 2005
//
// Copyright 2007-2015 Shaun Mahony
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


#ifndef TREE_MARK
#define TREE_MARK

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "globals.h"
#include "Motif.h"
#include "Alignment.h"
#include "PlatformSupport.h"

class Child{
public:
	Motif* m;
	int mID;
	Child* next;
};

class TreeNode{
public:
	bool leaf;
	double height;
	double edge;
	Motif* profile;
	TreeNode* left;
	TreeNode* right;
	TreeNode* parent;
	TreeNode* sibling; //only used by neural trees
	double avgPval; //only used by neural trees
	int members;
	Child* progeny;
	MultiAlignRec* alignment;
	int nodeID;
	int leafID; //tmp

	//Constructor
	TreeNode(){profile = NULL; left=NULL; right=NULL; parent=NULL; height=0;edge=0; progeny=NULL;alignment=NULL;members=0;avgPval=0;}

	//Random Init
	void RandomInit();

	//Destructor
	~TreeNode();
};

//The general tree building class
class Tree{
protected:
	PlatformSupport* Plat;
	Alignment* Aman;
	bool treeTesting;
	int numNodes;
	int numLeaves;
	double nodesMinCH;	//Minimum Calinski & Harabasz statistic (if testing for this)
	bool silence;

	//Build FBPs for a node based on its list of children (TEMPORARY METHOD -- GAPS NOT SUPPORTED)
	void BuildFBP(TreeNode* n, AlignRec** pairwiseAlign, int nameID);
	//Related to the above method
	void PostorderListChildren(TreeNode* n, TreeNode* start);
	//Info content of a column
	double Info(double* col);
	//Kill the children
	void KillChildren(TreeNode* n);
	//Method used to print the tree
	void PostorderPrintTree(TreeNode* n, FILE* out, FILE* orderMat=NULL);
	//Method used to print the node's children
	void PostorderPrintNodes(TreeNode* n, FILE* out);
	//Print the matrices and children names for a node
	void PrintNode(TreeNode* n, FILE* out);
	//Deletion method
	void PostorderDeleteTree(TreeNode* n);

	//PPA Multiple alignment code replication
	void PPAAlignment(TreeNode* n, TreeNode* start, int leaveOutID=-1);
	//IR Multiple alignment code replication
	void IRAlignment(TreeNode* n, int leaveOutID=-1);
	//support methods
	Motif* Alignment2Profile(MultiAlignRec* alignment, const char* name, int leaveOutID=-1);
	Motif* Alignment2SWFBP(MultiAlignRec* alignment, const char* name, int leaveOutID=-1);
	MultiAlignRec* SingleProfileSubtraction(MultiAlignRec* alignment, int removeID);
	MultiAlignRec* SingleProfileAddition(MultiAlignRec* alignment, Motif* two, int twoID);

public:
	//The root of the tree
	TreeNode* root;

	//Constructor
	Tree(Alignment* A=NULL){root=NULL;Aman=A;silence=false;}

	//Virtual building method
	virtual void BuildTree(PlatformSupport* p, bool treeTest=false)=0;
	virtual void LOOCVBuildTree(PlatformSupport* p, bool treeTest=true)=0;

	//Print the tree
	void PrintTree(char* outName);
	//Print the tree
	void PrintNodes(char* outName);
	//Accessor
	double GetNodesMinCH(){return nodesMinCH;}
	//Print the tree at a given level (number of nodes)
	void PrintLevel(char* outFile, int levelNum);
	//Enforce silence
	void BeQuiet(bool q){silence=q;}

	//Destructor
	virtual ~Tree(){if(root!=NULL){PostorderDeleteTree(root);}};
};

//UPGMA
class UPGMA : public Tree
{
public:
	//Constructor
	UPGMA(Alignment* A):Tree(A){};

	//Build the tree
	void BuildTree(PlatformSupport* p, bool treeTest=false);
	void LOOCVBuildTree(PlatformSupport* p, bool treeTest=true);
};

//Neighbour-joining
class Neighbourjoin : public Tree
{
public:
	//Constructor
	Neighbourjoin(Alignment* A):Tree(A){};

	//Build the tree
	void BuildTree(PlatformSupport* p, bool treeTest=false);
	void LOOCVBuildTree(PlatformSupport* p, bool treeTest=true){}
};

#endif

