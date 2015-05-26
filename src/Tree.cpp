//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1
//
// Written By: Shaun Mahony
//
// Tree.cpp
//
// Started: 5th Dec 2005
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

#include "Tree.h"

//Destructor
TreeNode::~TreeNode()
{
	Child* tmpChild;
	if(profile!=NULL){delete profile;}
	tmpChild = progeny;
	while(progeny!=NULL){
		progeny = tmpChild->next;
		delete tmpChild;
		tmpChild=progeny;
	}
	if(alignment!=NULL)
		delete alignment;
}
//kill the child nodes
void Tree::KillChildren(TreeNode* n){
	Child* tmpChild;
	tmpChild = n->progeny;
	while(n->progeny!=NULL){
		n->progeny = tmpChild->next;
		delete tmpChild;
		tmpChild=n->progeny;
	}n->progeny=NULL;
}

//Tree node Random init
void TreeNode::RandomInit()
{
	double Ac, Gc, Cc, Tc;
	int INIT_SIZE=8;

	//Random initialisation
	profile = new Motif(INIT_SIZE);
	for(int k=0; k<INIT_SIZE; k++)
	{
		Ac=(double)rand()/RAND_MAX;
		Cc=(double)rand()/RAND_MAX;
		Gc=(double)rand()/RAND_MAX;
		Tc=(double)rand()/RAND_MAX;
		double ttl = Ac+Cc+Gc+Tc;
		Ac=Ac/ttl;
		Cc=Cc/ttl;
		Gc=Gc/ttl;
		Tc=Tc/ttl;
		profile->f[k][0]=Ac;
		profile->f[k][1]=Cc;
		profile->f[k][2]=Gc;
		profile->f[k][3]=Tc;
	}
}

//UPGMA's tree building method
void UPGMA::BuildTree(PlatformSupport* p, bool treeTest)
{
	Plat = p;
	treeTesting=treeTest;
	int numMotifs = Plat->GetMatCount();
	Motif** motifSet = Plat->inputMotifs;
	AlignRec** pairwiseAlign = Plat->pairwiseAlign;

	int i, j, k, z;
	TreeNode* tmpNode;
	TreeNode** nodes = new TreeNode*[numMotifs];
    bool* active = new bool[numMotifs];
    double minCH = 10000000;
    nodesMinCH = numMotifs;

//	double* error = new double[numMotifs];////////////////Necessary only for Davies-Bouldin
	for(i=0; i<numMotifs; i++){
		nodes[i] = new TreeNode();
		nodes[i]->profile = new Motif(motifSet[i]->GetLen());
		motifSet[i]->CopyMotif(nodes[i]->profile);
		nodes[i]->leaf=true;
		nodes[i]->members=1;
		nodes[i]->leafID=i;
		active[i]=true;
		PostorderListChildren(nodes[i], nodes[i]);
	}double generalMean=0, count=0;
	double** pairwiseDist = new double* [numMotifs];
	for(i=0; i<numMotifs; i++){
		pairwiseDist[i]=new double [numMotifs];
		for(j=0; j<numMotifs; j++){
			if(i!=j)
			{	pairwiseDist[i][j]=pairwiseAlign[i][j].dist;
				generalMean+=(pairwiseAlign[i][j].dist*pairwiseAlign[i][j].dist);
				count++;
			}
		}
	}generalMean=generalMean/count;

	//This loop iterates until all nodes are on the tree
	for(z=0; z<numMotifs-1; z++){
		double minDist=10000;
		int minNodeA, minNodeB;
		//Step 1: find the two nodes for which dij is minimal
		for(i=0; i<numMotifs; i++){
			if(active[i]){
				for(j=0; j<numMotifs; j++){
					if(i!=j && active[j] && pairwiseDist[i][j]<minDist){
						minDist = pairwiseDist[i][j];
						minNodeA=i; minNodeB=j;
					}
				}
			}
		}

		//Step 2: put minNodes A&B into new Node
		tmpNode = new TreeNode();
		tmpNode->left = nodes[minNodeA];
		tmpNode->right = nodes[minNodeB];
		nodes[minNodeB]->parent=tmpNode;
		tmpNode->members = nodes[minNodeA]->members + nodes[minNodeB]->members;
		tmpNode->height = minDist/2.0;
		nodes[minNodeA]->edge=tmpNode->height-nodes[minNodeA]->height;
		nodes[minNodeB]->edge=tmpNode->height-nodes[minNodeB]->height;
		tmpNode->leaf=false;
		tmpNode->nodeID = z;
		PostorderListChildren(tmpNode, tmpNode);
        if(treeTesting)
			IRAlignment(tmpNode);
		else
			BuildFBP(tmpNode, pairwiseAlign,z);
		char tmpname[50];
		sprintf(tmpname, "Internal_%d", z);
		strcpy(tmpNode->profile->name, tmpname);
		//Step 3: Add tmpNode into minNodeA's spot, inactivate minNodeB's spot, update dists for new node
		nodes[minNodeA] = tmpNode;
		active[minNodeB]=false;
		for(j=0; j<numMotifs; j++){
			if(minNodeA!=j && active[j])
			{	pairwiseDist[minNodeA][j] = (pairwiseDist[minNodeA][j]*(double)nodes[minNodeA]->members + pairwiseDist[minNodeB][j]*(double)nodes[minNodeB]->members)/((double)nodes[minNodeA]->members + (double)nodes[minNodeB]->members);
				pairwiseDist[j][minNodeA] = (pairwiseDist[j][minNodeA]*(double)nodes[minNodeA]->members + pairwiseDist[j][minNodeB]*(double)nodes[minNodeB]->members)/((double)nodes[minNodeA]->members + (double)nodes[minNodeB]->members);
			}
		}
		//test the exclusivity of each node
		if(treeTesting){
			Child* tmpA; Child* tmpB;
			double nodeCount=0;
			double totalHomo=0, currHomo=0;
			for(j=0; j<numMotifs; j++){
				if(active[j]){nodeCount++;}
			}
			nodeCount=0;
			//Homogeneity of the node contents
			for(j=0; j<numMotifs; j++){
				currHomo=0;
				if(active[j]){
					nodeCount++;
					if(nodes[j]->members==1){
						currHomo++;
					}else{
						for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next){
							for(tmpB=nodes[j]->progeny; tmpB!=NULL; tmpB=tmpB->next)
								if(strcmp(tmpA->m->famName, tmpB->m->famName)==0)
									currHomo++;
						}
					}
					currHomo=currHomo/((double)nodes[j]->members*(double)nodes[j]->members);
					totalHomo+=currHomo;
				}
			}
			totalHomo=totalHomo/nodeCount;

			///////////Calinski & Harabasz///////////////////////////
            //Internal similarity of the nodes & between clusters
			double internalSOSE=0, betweenSOSE=0, Ak=0;
			double currE=0, currCount, tmpAvgDist;double tmpE;
			for(j=0; j<numMotifs; j++){
				if(active[j]){
					if(nodes[j]->members==1)
					{	currE=0;currCount=1;count=1;
					}else{currCount=0;count=0;currE=0;
						for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next){count++;
							for(tmpB=nodes[j]->progeny; tmpB->mID!=tmpA->mID; tmpB=tmpB->next)
								if(tmpA->mID!=tmpB->mID)
								{
									currCount++; currE+=pairwiseAlign[tmpA->mID][tmpB->mID].dist*pairwiseAlign[tmpB->mID][tmpA->mID].dist;
								}
						}
					}
					internalSOSE+=currE;
					Ak+=(count-1)*(generalMean-(currE/currCount));
				}
			}Ak = Ak/((double)numMotifs-nodeCount);
			for(int w=0; w<numMotifs; w++){
				for(int v=0; v<w; v++){
					if(v!=w && active[w] && active[v]){
						tmpAvgDist = (pairwiseDist[v][w]+pairwiseDist[w][v])/2;
						betweenSOSE+=(tmpAvgDist*tmpAvgDist);
					}
				}
			}
			internalSOSE = log(internalSOSE);
			betweenSOSE = log(betweenSOSE);
			if(nodeCount>1){
				//This works!
				//printf("%.0lf\t%lf\t%.10lf\t%lf\n", nodeCount, betweenSOSE, internalSOSE, (((betweenSOSE+nodeCount)/(nodeCount-1))/((internalSOSE+nodeCount)/(numMotifs-nodeCount))));
				//printf("%.0lf\t%lf\t%.10lf\t%lf\n", nodeCount, betweenSOSE, internalSOSE, ((betweenSOSE/(nodeCount-1))+(nodeCount/numMotifs))/((internalSOSE/(numMotifs-nodeCount))+(nodeCount/numMotifs)));

				//printf("%.0lf\t%lf\t%lf\t%lf\t%lf\n", nodeCount, totalHomo, (betweenSOSE/(nodeCount-1)), internalSOSE/(numMotifs-nodeCount), (((betweenSOSE)/(nodeCount-1))/((internalSOSE)/(numMotifs-nodeCount))));

				double currCH = (((betweenSOSE)/(nodeCount-1))/((internalSOSE)/(numMotifs-nodeCount)));
				if(!silence){
					printf("\t%.0lf\t%lf\n", nodeCount, currCH);
				}
				if(currCH < minCH){minCH=currCH; nodesMinCH = nodeCount;}

				//HC p10
				if((generalMean-Ak)>0){
					double HC = (generalMean+(((double)numMotifs-nodeCount)/(nodeCount-1))*Ak)/(generalMean-Ak);
				}
				double numerate=(generalMean+(((double)numMotifs-nodeCount)/(nodeCount-1))*Ak);
				double denominate=generalMean-Ak;
			}
			//Level-specific code!
			if(nodeCount==-1){
				FILE* tmpF = fopen("FBPmotifs.transfac", "w");
				for(j=0; j<numMotifs; j++){
					if(active[j]){
						//nodes[j]->profile->PrintMotif(tmpF);
						PrintNode(nodes[j], tmpF);
					}
				}fclose(tmpF);

				//pseudo LOOCV
				printf("Non-matches\n");
				count=0; double correct=0;
				for(j=0; j<numMotifs; j++){
					if(active[j]){
						if(nodes[j]->members==1){
						}else{
							for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next){
								count++;
								printf("Testing %s_%s\n", tmpA->m->famName, tmpA->m->GetName());
								//PPAAlignment(nodes[j], nodes[j], tmpA->mID);
								IRAlignment(nodes[j], tmpA->mID);

								double LOOMin = 100000000, LOOMax=0; int LOOMinIndex = 0;
								double currPred=0;
								for(int q=0; q<numMotifs; q++){//Find closest node
									currPred=0;
									if(active[q]){
										int t_i1, t_i2, t_al; bool t_f1, t_f2;
										double currS = Aman->AlignMotifs2D(tmpA->m, nodes[q]->profile, t_i1, t_i2, t_al, t_f1, t_f2);
										double currP = Plat->Score2PVal(tmpA->m->GetLen(), nodes[q]->profile->GetLen(), currS);
										if(currP>LOOMax){
											LOOMax=currP; LOOMinIndex=q;
										}
									}
								}
								if(LOOMinIndex==j){
									correct++; nodes[j]->profile->PrintMotifConsensus(); printf("Correct... score = %.4e\n", 1-LOOMax);
								}else{
									printf("%s_%s\t%s\n", tmpA->m->famName, tmpA->m->GetName(), nodes[LOOMinIndex]->profile->GetName());
									printf("\t%s\t", tmpA->m->GetName());
									tmpA->m->PrintMotifConsensus();
									printf("\n\t%s\t", nodes[j]->profile->GetName());
									nodes[j]->profile->PrintMotifConsensus();
									printf("\n\t%s\t", nodes[LOOMinIndex]->profile->GetName());
									nodes[LOOMinIndex]->profile->PrintMotifConsensus();
									printf("\n");
									printf("Incorrect... score = %.4e\n", 1-LOOMax);
								}
							}
							//PPAAlignment(nodes[j], nodes[j]);
							IRAlignment(nodes[j]);
						}
					}
				}
				printf("\nPerformance: %lf (%.0lf from %.0lf)\n", correct/count, correct, count);

			}

			//
			/*
			//////////////////Gap Statistic///////////////////////////////
			//Internal similarity of the nodes & between clusters
			double internalE=0, betweenE=0, Ak=0;
			double currE=0, currCount, tmpAvgDist;double tmpE;
			for(j=0; j<numMotifs; j++){
				if(active[j]){
					if(nodes[j]->members==1)
					{	currE=0;currCount=1;count=1;
					}else{currCount=0;count=0;currE=0;
						for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next){count++;
							for(tmpB=nodes[j]->progeny; tmpB->mID!=tmpA->mID; tmpB=tmpB->next)
								if(tmpA->mID!=tmpB->mID)
								{	//tmpE=pairwiseAlign[tmpA->mID][tmpB->mID].p_value;
									currCount++; currE+=pairwiseAlign[tmpA->mID][tmpB->mID].dist*pairwiseAlign[tmpB->mID][tmpA->mID].dist;}
						}
					}
					internalE+=currE;//(currE/(currCount));
				}
			}printf("Gap\t%.0lf\t%lf\t%lf\n", nodeCount, internalE, log(internalE));

			//Davies-Bouldin
			//first compute e's
			double currE=0, currCount, tmpAvgDist;double tmpE;
			for(j=0; j<numMotifs; j++){
				if(active[j]){
					if(nodes[j]->members==1)
					{	currE=0;currCount=1;count=1;
					}else{currCount=0;count=0;currE=0;
						for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next){count++;
							for(tmpB=nodes[j]->progeny; tmpB!=NULL; tmpB=tmpB->next)
								if(tmpA->mID!=tmpB->mID)
								{	currCount++; currE+=pairwiseAlign[tmpA->mID][tmpB->mID].dist;
								}
						}
					}
					error[j]=(currE/currCount);
				}
			}
			//Next find the maximal R_jk's
			double DB=0, Rk=0, currR; int MaxRk=0;
			for(k=0; k<numMotifs; k++){
				if(active[k]){
					Rk=0;
					for(j=0; j<numMotifs; j++){
						if(active[j] && k!=j){
							currR = (error[j]+error[k])/((pairwiseDist[j][k]+pairwiseDist[k][j])/2);
							if(currR>Rk){
								Rk=currR;
								MaxRk = j;
							}
						}
					}
					DB+=Rk;
				}
			}DB = DB/nodeCount;
			printf("%.0lf\t%lf\n", nodeCount, DB);
			*/
		}
	}
	//Tree building finished, the last node (i.e. tmpNode), should be the root
	root = tmpNode;
	root->nodeID=numMotifs-1;
	root->edge = tmpNode->height;
	delete [] active;
}

//UPGMA's tree building method (LOOCV)
void UPGMA::LOOCVBuildTree(PlatformSupport* p, bool treeTest)
{
	Plat = p;
	treeTesting=treeTest;
	int numMotifs = Plat->GetMatCount();
	Motif** motifSet = Plat->inputMotifs;
	AlignRec** pairwiseAlign = Plat->pairwiseAlign;
	int i, j, k, z, x, q;
	//Matrices here for keeping average performance
	double* homogeneities = new double[numMotifs-1];
	double* predictivity = new double[numMotifs-1];
	double* HCList = new double[numMotifs-1]; double HCMin=1000;double HC, HCMinPred, HCMinIndex;
	double totalHCMin=0, totalHCMinPred=0;
	for(q=0; q<numMotifs-1; q++){
		homogeneities[q]=0;
		predictivity[q]=0;
		HCList[q]=0;
	}

	for(x=0; x<numMotifs; x++){HCMin=1000;HCMinIndex=-1;
		TreeNode* tmpNode;
		TreeNode** nodes = new TreeNode*[numMotifs];
		bool* active = new bool[numMotifs];
		for(i=0; i<numMotifs; i++){
			nodes[i] = new TreeNode();
			nodes[i]->profile = new Motif(motifSet[i]->GetLen());
			motifSet[i]->CopyMotif(nodes[i]->profile);
			nodes[i]->leaf=true;
			nodes[i]->members=1;
			nodes[i]->leafID=i;
			active[i]=true;

		}
		double** pairwiseDist = new double* [numMotifs];
		for(i=0; i<numMotifs; i++){
			pairwiseDist[i]=new double [numMotifs];
			for(j=0; j<numMotifs; j++){
				if(i!=j)
				{	pairwiseDist[i][j]=pairwiseAlign[i][j].dist;
				}
			}
		}

		//This loop iterates until all nodes are on the tree
		for(z=0; z<numMotifs-2; z++){
			double minDist=10000;
			int minNodeA, minNodeB;
			//Step 1: find the two nodes for which dij is minimal
			for(i=0; i<numMotifs; i++){
				if(i!=x){
				if(active[i]){
					for(j=0; j<numMotifs; j++){
						if(j!=x){
						if(i!=j && active[j] && pairwiseDist[i][j]<minDist){
							minDist = pairwiseDist[i][j];
							minNodeA=i; minNodeB=j;
						}}
					}
				}}
			}

			//Step 2: put minNodes A&B into new Node
			tmpNode = new TreeNode();
			tmpNode->left = nodes[minNodeA];
			tmpNode->right = nodes[minNodeB];
			nodes[minNodeB]->parent=tmpNode;
			tmpNode->members = nodes[minNodeA]->members + nodes[minNodeB]->members;
			tmpNode->height = minDist/2.0;
			nodes[minNodeA]->edge=tmpNode->height-nodes[minNodeA]->height;
			nodes[minNodeB]->edge=tmpNode->height-nodes[minNodeB]->height;
			tmpNode->leaf=false;
			tmpNode->nodeID = z;
			PostorderListChildren(tmpNode, tmpNode);
			//BuildFBP(tmpNode, pairwiseAlign,z);
			PPAAlignment(tmpNode, tmpNode);
			//IRAlignment(tmpNode);
			//Step 3: Add tmpNode into minNodeA's spot, inactivate minNodeB's spot, update dists for new node
			nodes[minNodeA] = tmpNode;
			active[minNodeB]=false;
			for(j=0; j<numMotifs; j++){
				if(minNodeA!=j && active[j])
				{	pairwiseDist[minNodeA][j] = (pairwiseDist[minNodeA][j]*(double)nodes[minNodeA]->members + pairwiseDist[minNodeB][j]*(double)nodes[minNodeB]->members)/((double)nodes[minNodeA]->members + (double)nodes[minNodeB]->members);
					pairwiseDist[j][minNodeA] = (pairwiseDist[j][minNodeA]*(double)nodes[minNodeA]->members + pairwiseDist[j][minNodeB]*(double)nodes[minNodeB]->members)/((double)nodes[minNodeA]->members + (double)nodes[minNodeB]->members);
				}
			}
			//test the exclusivity of each node
			if(treeTesting){
				Child* tmpA; Child* tmpB;
				double nodeCount=0;
				double totalHomo=0, currHomo=0;//Homogeneity of the node contents
				for(j=0; j<numMotifs; j++){
					if(j!=x){
					currHomo=0;
					if(active[j]){
						nodeCount++;
						if(nodes[j]->members==1)
							currHomo++;
						else{
							for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next)
								for(tmpB=nodes[j]->progeny; tmpB!=NULL; tmpB=tmpB->next)
									if(strcmp(tmpA->m->famName, tmpB->m->famName)==0)
										currHomo++;
						}
						currHomo=currHomo/((double)nodes[j]->members*(double)nodes[j]->members);
						totalHomo+=currHomo;
					}}
				}
				totalHomo=totalHomo/nodeCount;
				homogeneities[(int)nodeCount]+=totalHomo;
				//printf("%.0lf\t%lf\n", nodeCount, totalHomo);

				///////////Calinski & Harabasz///////////////////////////
				double internalSOSE=0, betweenSOSE=0;
				double currE=0, currCount, tmpAvgDist;double tmpE;
				for(j=0; j<numMotifs; j++){
					if(j!=x && active[j]){
						if(nodes[j]->members==1)
						{	currE=0;currCount=1;
						}else{currCount=0;currE=0;
							for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next){
								for(tmpB=nodes[j]->progeny; tmpB->mID!=tmpA->mID; tmpB=tmpB->next)
									if(tmpA->mID!=tmpB->mID)
									{	currCount++; currE+=pairwiseAlign[tmpA->mID][tmpB->mID].dist*pairwiseAlign[tmpB->mID][tmpA->mID].dist;
									}
							}
						}internalSOSE+=currE;
					}
				}
				for(int w=0; w<numMotifs; w++){
					for(int v=0; v<w; v++){
						if(v!=x && w!=x && v!=w && active[w] && active[v]){
							tmpAvgDist = (pairwiseDist[v][w]+pairwiseDist[w][v])/2;
							betweenSOSE+=(tmpAvgDist*tmpAvgDist);
						}
					}
				}
				internalSOSE = log(internalSOSE);
				betweenSOSE = log(betweenSOSE);
				if(nodeCount>1 && nodeCount<(numMotifs-1)){
					HC = (((betweenSOSE)/(nodeCount-1))/((internalSOSE)/((numMotifs-1)-nodeCount)));
					HCList[(int)nodeCount]+=HC;
					if(HC<HCMin){
						HCMin=HC;
						HCMinIndex=nodeCount;
					}
					//printf("%.0lf\t%lf\t%lf\t%lf\t%lf\n", nodeCount, totalHomo, (betweenSOSE/(nodeCount-1)), internalSOSE/(numMotifs-nodeCount), (((betweenSOSE)/(nodeCount-1))/((internalSOSE)/(numMotifs-nodeCount))));
				}
				//now test the predictive capacity of the current tree against the left-out motif
				double LOOMin = 100000000, LOOMax=0;; int LOOMinIndex = 0;
				double currPred=0;
				for(j=0; j<numMotifs; j++){//Find closest node
					if(j!=x){
					currPred=0;
					if(active[j]){
						//This is one way of doing it...
						/*if(pairwiseDist[x][j]<LOOMin){
							LOOMin=pairwiseDist[x][j];LOOMinIndex=j;
						}if(pairwiseDist[j][x]<LOOMin){
							LOOMin=pairwiseDist[j][x];LOOMinIndex=j;
						}*/
						//This is another; align versus the FBPs
						int t_i1, t_i2, t_al; bool t_f1, t_f2;
						double currS = Aman->AlignMotifs2D(motifSet[x], nodes[j]->profile, t_i1, t_i2, t_al, t_f1, t_f2);
						double currP = Plat->Score2PVal(motifSet[x]->GetLen(), nodes[j]->profile->GetLen(), currS);
						if(currP>LOOMax){
							LOOMax=currP; LOOMinIndex=j;
						}
					}
					}
				}
				if(nodes[LOOMinIndex]->members==1 && strcmp(motifSet[LOOMinIndex]->famName, motifSet[x]->famName)==0){
						currPred++;
				}else{
					for(tmpA=nodes[LOOMinIndex]->progeny; tmpA!=NULL; tmpA=tmpA->next)
						if(strcmp(tmpA->m->famName, motifSet[x]->famName)==0)
							currPred++;
				}
				currPred = currPred/((double)nodes[LOOMinIndex]->members);
				predictivity[(int)nodeCount]+=currPred;

				//Catch the predictivity for the predicted number of clusters!
				if(nodeCount==HCMinIndex){
					HCMinPred=currPred;
				}
			}
		}
		//Tree building finished, the last node (i.e. tmpNode), should be the root
		root = tmpNode;
		root->nodeID=numMotifs-1;
		root->edge = tmpNode->height;
		delete [] active;
		PostorderDeleteTree(root);
		printf("%.0lf\t%lf\n", HCMinIndex, HCMinPred);
		totalHCMin+=HCMinIndex; totalHCMinPred+=HCMinPred;
	}
	printf("Homogeneities\n");
	for(q=0; q<numMotifs-1; q++){
		printf("%d\t%lf\t%lf\n", q, homogeneities[q]/((double)numMotifs), predictivity[q]/((double)numMotifs));
	}printf("Average Clusters Predicted: %lf\nAverage Performance: %lf\n", totalHCMin/(double)numMotifs, totalHCMinPred/(double)numMotifs);
	delete [] homogeneities;
	delete [] predictivity;
	delete [] HCList;
	BuildTree(p, false);
}


// *********************************************************************************** //

//Neighbour-joinings's tree building method
void Neighbourjoin::BuildTree(PlatformSupport* p, bool treeTest)
{
	Plat = p;
	treeTesting=treeTest;
	int numMotifs = Plat->GetMatCount();
	Motif** motifSet = Plat->inputMotifs;
	AlignRec** pairwiseAlign = Plat->pairwiseAlign;

	int i, j, k, z;
	int minNodeA, minNodeB;
	TreeNode* tmpNode;
	TreeNode** nodes = new TreeNode*[numMotifs];
    bool* active = new bool[numMotifs];
	double numActive = (double)numMotifs;
	double* r = new double[numMotifs];
	//double r_i, r_j, min_r_i, min_r_j;
	for(i=0; i<numMotifs; i++){
		nodes[i] = new TreeNode();
		nodes[i]->profile = new Motif(motifSet[i]->GetLen());
		motifSet[i]->CopyMotif(nodes[i]->profile);
		nodes[i]->leaf=true;
		nodes[i]->members=1;
		active[i]=true;
		nodes[i]->leafID=i;
		r[i]=0;
	}
	double** pairwiseDist = new double* [numMotifs];
	for(i=0; i<numMotifs; i++){
		pairwiseDist[i]=new double [numMotifs];
		for(j=0; j<numMotifs; j++){
			if(i!=j)
			{	//pairwiseDist[i][j]=(1-pairwiseAlign[i][j].p_value);
				pairwiseDist[i][j]=pairwiseAlign[i][j].dist;
				r[i]+=pairwiseDist[i][j];
			}
		}
		r[i]=r[i]/(numActive-2.0);
	}

	//Test for additivity!
/*	int a,b,c,d;
	for(d=0; d<numMotifs; d++)
		for(c=0; c<d; c++)
			for(b=0; b<c; b++)
				for(a=0; a<b; a++){
					printf("A:%d B:%d C:%d D:%d\tAB+CD:%lf\tAC+BD:%lf\tAD+BC:%lf\n", a, b, c, d, pairwiseDist[a][b]+pairwiseDist[c][d], pairwiseDist[a][c]+pairwiseDist[b][d], pairwiseDist[a][d]+pairwiseDist[b][c]);
				}
*/
	//This loop iterates until all nodes are on the tree
	for(z=0; z<numMotifs-2; z++){
		double minDist=1000000;
		//Step 1: find the two nodes for which Dij is minimal
		for(i=0; i<numMotifs; i++){
			if(active[i]){
				for(j=0; j<i; j++){
					if(i!=j && active[j]){//&& (pairwiseDist[i][j]-(r[i]+r[j]))<minDist){
						if(pairwiseDist[i][j]-(r[i]+r[j])<minDist){
							minDist = (pairwiseDist[i][j]-(r[i]+r[j]));
							minNodeA=i; minNodeB=j;
						}
					}
				}
			}
		}
//		printf("Got Here: %d, %d, %lf, %.0lf, %d, %d\n",minNodeA, minNodeB, pairwiseDist[minNodeA][minNodeB]-(r[minNodeA]+r[minNodeB]), numActive, numMotifs, z);
		//Step 2: put minNodes A&B into new Node
		tmpNode = new TreeNode();
		tmpNode->left = nodes[minNodeA];
		nodes[minNodeA]->parent=tmpNode;
		nodes[minNodeA]->edge=(pairwiseDist[minNodeA][minNodeB]/2)+((r[minNodeA]-r[minNodeB])/2);
		tmpNode->right = nodes[minNodeB];
		nodes[minNodeB]->parent=tmpNode;
		nodes[minNodeB]->edge=pairwiseDist[minNodeA][minNodeB]-nodes[minNodeA]->edge;
		tmpNode->members = nodes[minNodeA]->members + nodes[minNodeB]->members;
	//	tmpNode->height = minDist/2.0;
		tmpNode->leaf=false;
		tmpNode->nodeID=z;
		PostorderListChildren(tmpNode, tmpNode);
		BuildFBP(tmpNode, pairwiseAlign,z);
		//Step 3: Add tmpNode into minNodeA's spot, inactivate minNodeB's spot, update dists for new node
		nodes[minNodeA] = tmpNode;
		active[minNodeB]=false; numActive--;
		double AvsB = pairwiseDist[minNodeA][minNodeB];
		double BvsA = pairwiseDist[minNodeB][minNodeA];
		for(j=0; j<numMotifs; j++){
			if(minNodeA!=j && active[j])
			{	pairwiseDist[minNodeA][j] = (pairwiseDist[minNodeA][j]+pairwiseDist[minNodeB][j]-AvsB)/2;
				pairwiseDist[j][minNodeA] = (pairwiseDist[j][minNodeA]+pairwiseDist[j][minNodeB]-BvsA)/2;
			}
		}
		for(i=0; i<numMotifs; i++){
			r[i]=0;
			for(j=0; j<numMotifs; j++){
				if(i!=j && active[i] && active[j])
					r[i]+=pairwiseDist[i][j];
			}r[i]=r[i]/(numActive-2);
		}
		//test the exclusivity of each node
		if(treeTesting){
			Child* tmpA; Child* tmpB;
			double nodeCount=0;
			double totalHomo=0, currHomo=0;//Homogeneity of the node contents
			for(j=0; j<numMotifs; j++){
				currHomo=0;
				if(active[j]){
					nodeCount++;
					if(nodes[j]->members==1)
						currHomo++;
					else{
						for(tmpA=nodes[j]->progeny; tmpA!=NULL; tmpA=tmpA->next)
							for(tmpB=nodes[j]->progeny; tmpB!=NULL; tmpB=tmpB->next)
								if(strcmp(tmpA->m->famName, tmpB->m->famName)==0)
									currHomo++;
					}
					currHomo=currHomo/((double)nodes[j]->members*(double)nodes[j]->members);
					totalHomo+=currHomo;
				}
			}
			totalHomo=totalHomo/nodeCount;
			printf("%.0lf\t%lf\n", nodeCount, totalHomo);
		}
	}

	bool oneFound=false;
	for(i=0; i<numMotifs; i++){
		if(active[i] && !oneFound)
		{	minNodeA=i; oneFound=true;}
		else if(active[i])
			minNodeB=i;
	}
	tmpNode = new TreeNode();
	tmpNode->leaf=false;
	tmpNode->nodeID=numMotifs-1;
	tmpNode->left = nodes[minNodeA];
	nodes[minNodeA]->parent=tmpNode;
	nodes[minNodeA]->edge=pairwiseDist[minNodeA][minNodeB]/2;
	tmpNode->right = nodes[minNodeB];
	nodes[minNodeB]->parent=tmpNode;
	nodes[minNodeB]->edge=pairwiseDist[minNodeA][minNodeB]/2;
	tmpNode->members = nodes[minNodeA]->members + nodes[minNodeB]->members;
	PostorderListChildren(tmpNode, tmpNode);
	BuildFBP(tmpNode, pairwiseAlign,numMotifs-1);

	//Tree building finished, the last node (i.e. tmpNode), should be the root
	root = tmpNode;
	root->edge = pairwiseDist[minNodeA][minNodeB];
	delete [] active;
	delete [] r;
}

// *********************************************************************************** //

//Private method: Print out the tree
void Tree::PostorderPrintTree(TreeNode* n, FILE* out, FILE* orderMat)
{
	char tmp_str[100];
	double dist;

	if(n->left != NULL){ fprintf(out, "("); PostorderPrintTree(n->left, out, orderMat); fprintf(out, ",");}
	if(n->right != NULL){
		PostorderPrintTree(n->right, out, orderMat);
		//if(n->parent!=NULL){
			//dist=n->parent->height-n->height;
			dist=n->edge;
		//}else{ dist =0; }
		fprintf(out, "):%lf", fabs(dist)); //use this to print branch lengths
		//fprintf(out, ")");
		//printf("):%lf\n", dist);
	}if(n->leaf)
	{
		if(orderMat!=NULL)
			n->profile->PrintMotif(orderMat);

		sprintf(tmp_str, "%s", n->profile->name);
		//Limit of 20chars for Phylip drawgram program
		tmp_str[20]='\0';
		//fprintf(out, "%s_%s:%lf", n->profile->famName, tmp_str, fabs(n->edge)); //use this to print branch lengths & family names
		fprintf(out, "%s:%lf", tmp_str, fabs(n->edge)); //use this to print branch lengths
		//fprintf(out, "%s", tmp_str);
		//fprintf(out, "%s_%s:0.0", n->profile->famName, tmp_str);
		//fprintf(out, "%s_%s:%lf", n->profile->famName, tmp_str, (n->parent->height - n->height));
		//printf("%s:%lf\n", tmp_str, (n->parent->height - n->height));
	}else{
		if(orderMat!=NULL)
			n->profile->PrintMotif(orderMat);
	}
}
//Print the tree
void Tree::PrintTree(char* outFile)
{
	char outName[STR_LEN];
	sprintf(outName, "%s.tree", outFile);
	FILE* out = fopen(outName, "w");
	if(out==NULL){printf("error; can't open output file %s\n", outName); exit(1);}

	//FILE* orderMat = fopen("orderMat.txt", "w+");
	FILE* orderMat=NULL;

	PostorderPrintTree(root, out, orderMat);
	fprintf(out, ";");

	if(orderMat!=NULL)
		fclose(orderMat);
	fclose(out);
}

//Tree deletion
void Tree::PostorderDeleteTree(TreeNode* n)
{
	if(n->left != NULL){ PostorderDeleteTree(n->left);}
	if(n->right != NULL){PostorderDeleteTree(n->right);}
	delete n;
}

//Populate the list of progeny
void Tree::PostorderListChildren(TreeNode* n, TreeNode* start)
{
	if(n->left != NULL){PostorderListChildren(n->left, start);}
	if(n->right != NULL){PostorderListChildren(n->right, start);}
	if(n->leaf)
	{
		Child* tmp=new Child();
		tmp->next = start->progeny;
		tmp->m=n->profile;
		tmp->mID=n->leafID;
		start->progeny = tmp;
	}
}

//Print the tree's details
void Tree::PrintNodes(char* outFile)
{
	char outName[STR_LEN];
	sprintf(outName, "%s_order.transfac", outFile);
	FILE* out = fopen(outName, "w");
	if(out==NULL){printf("error; can't open output file\n"); exit(1);}

	PostorderPrintNodes(root, out);

	fclose(out);
}

//Print the matrices and children names for each node
void Tree::PostorderPrintNodes(TreeNode* n, FILE* out)
{
	Child* tmp;
	int i, j;

//	for(tmp=n->progeny; tmp!=NULL; tmp=tmp->next){
//		fprintf(out, "%s\t", tmp->m->name);//printf("%s\n", tmp->m->name);
//	}
	if(n->leaf)
	{
		fprintf(out, "\nDE %s\n", n->profile->name);
		for(i=0; i<n->profile->len; i++)
		{
			fprintf(out, "%d\t", i);
			for(j=0; j<B; j++)
				fprintf(out, "%.4lf\t", n->profile->f[i][j]);
			fprintf(out, "%c\n", n->profile->ColConsensus(i));
		}
		fprintf(out, "XX\n\n");/**/
		//fprintf(out, "\n\n");
	}

	if(n->left != NULL){PostorderPrintNodes(n->left, out);}
	if(n->right != NULL){PostorderPrintNodes(n->right, out);}
}

//Print the matrices and children names for a node
void Tree::PrintNode(TreeNode* n, FILE* out)
{
	Child* tmp;
	int i, j;

	fprintf(out, "XX\tCluster FBP\n");
	fprintf(out, "DE %s\n", n->profile->name);
	for(i=0; i<n->profile->len; i++)
	{
		fprintf(out, "%d\t", i);
		for(j=0; j<B; j++)
			fprintf(out, "%.4lf\t", n->profile->f[i][j]);
		fprintf(out, "%c\n", n->profile->ColConsensus(i));
	}
	fprintf(out, "XX\n");/**/

	fprintf(out, "XX\tCluster_Members:\t");
	for(tmp=n->progeny; tmp!=NULL; tmp=tmp->next){
		fprintf(out, "%s\t", tmp->m->name);//printf("%s\n", tmp->m->name);
	}
	fprintf(out, "\n\n");
}

//Build FBPs for a node based on its list of children (GAPS NOT SUPPORTED YET!)
void Tree::BuildFBP(TreeNode* n, AlignRec** pairwiseAlign, int nameID)
{
	Child* curr; Child* currB;
	int i, j, k, m, a, x, y, currCount;
	int maxLen3 = 3*maxLen;
	int aStart = maxLen;
	int anchor; double currSim; double maxSim=0; double count=0;
	double** alignmentMat = new double*[maxLen3];
	double* alignCnt = new double [maxLen3];
	for(k=0; k<maxLen3; k++)
	{	alignmentMat[k] = new double[B];
		alignCnt[k]=0;
		for(m=0; m<B; m++)
		{	alignmentMat[k][m]=0;
		}
	}
	for(curr=n->progeny; curr!=NULL; curr=curr->next){count++;};
	double* weights = new double[(int)count];

	//first find the anchor (maxSim to all others)
	i=0;
	for(curr=n->progeny; curr!=NULL; curr=curr->next){
		currSim=0;
		for(currB=n->progeny; currB!=NULL; currB=currB->next){
			if(curr->mID != currB->mID){
				currSim+=pairwiseAlign[curr->mID][currB->mID].p_value;
			}
		}
		currSim = currSim/(count-1);
		weights[i]=currSim;
		if(currSim>maxSim){
			maxSim=currSim;
			anchor = curr->mID;
		}
		i++;
	}
	//Add in the hits according to weight
	curr = n->progeny; currCount=0;
	while(curr!=NULL){
		if(curr->mID != anchor)
		{
			Motif* rev = new Motif(curr->m->len);
			curr->m->RevCompMotif(rev);
			// ------->
			j=pairwiseAlign[anchor][curr->mID].i2;
			for(i=aStart+pairwiseAlign[anchor][curr->mID].i1; (i<maxLen3 && j<curr->m->len); i++)
			{
				for(k=0; k<B; k++)
				{	if(pairwiseAlign[anchor][curr->mID].forward1)
						alignmentMat[i][k]+=(curr->m->f[j][k] * weights[currCount]);
					else
						alignmentMat[i][k]+=(rev->f[j][k] * weights[currCount]);
				}
				alignCnt[i]++;
				j++;
			}
			// <-------
			j=pairwiseAlign[anchor][curr->mID].i2-1;
			for(i=aStart+(pairwiseAlign[anchor][curr->mID].i1-1); (i>=0 && j>=0); i--)
			{
				for(k=0; k<B; k++)
				{	if(pairwiseAlign[anchor][curr->mID].forward1)
						alignmentMat[i][k]+=(curr->m->f[j][k] * weights[currCount]);
					else
						alignmentMat[i][k]+=(rev->f[j][k] * weights[currCount]);
				}
				alignCnt[i]++;
				j--;
			}
			delete rev;
		}else{ //No alignment set up for best hit to itself... add the weighted alignment this way
			j=0;
			for(i=aStart; (i<maxLen3 && j<curr->m->len); i++)
			{
				for(k=0; k<B; k++)
					alignmentMat[i][k]+=(curr->m->f[j][k] * weights[currCount]);
				alignCnt[i]++;
				j++;
			}
		}
		curr=curr->next;
		currCount++;
	}
	//normalise matrix
	double colTot=0;
	for(i=0; i<maxLen3; i++)
	{
		colTot=0;
		for(j=0; j<B; j++)
			colTot+=alignmentMat[i][j];
		if(colTot!=0)
			for(j=0; j<B; j++)
				alignmentMat[i][j]=alignmentMat[i][j]/colTot;
		else
			for(j=0; j<B; j++)
				alignmentMat[i][j]=0.25;
	}
	//Scan the alignment, adding in columns if eligible
	bool run=true;
	int startI, endI;
	int modelLen=0;
	startI=aStart;
	endI=aStart+minFBPLen;
	modelLen=minFBPLen;

	for(a=aStart-1; (a>=0 && run); a--){
		if(Info(alignmentMat[a])>0.4 || (count>0 && alignCnt[a]>=count/2))
		{	startI=a; modelLen++;}
		else
			run=false;
	}
	run=true;
	for(a=aStart+minFBPLen+1; (a<maxLen3 && run); a++){
		if(Info(alignmentMat[a])>0.4 || (count>0 && alignCnt[a]>=count/2))
		{	endI=a; modelLen++;}
		else
			run=false;
	}
	//Make the model
	n->profile = new Motif(modelLen);
	for(x=0; x<modelLen; x++)
	{	for(y=0; y<B; y++)
		{
			n->profile->f[x][y] = alignmentMat[x+startI][y];
		}
	}
	char tmpname[50];
	sprintf(tmpname, "Internal_%d", nameID);
	strcpy(n->profile->name, tmpname);
	//WARNING -- PWM AND N MATRICES NOT DEFINED


	for(i=0; i<maxLen3; i++)
		delete [] alignmentMat[i];
	delete [] alignCnt;
	delete [] weights;
	delete [] alignmentMat;
}

//Find the information content in a motif's column
double Tree::Info(double* col)
{
	double sum=0;
	for(int b=0;b<B;b++) {
		if(col[b]) {
			sum+=col[b]*(log(col[b])/LOG_2);
		}
	}
	return 2+sum;
}

//Print the tree at a given level (number of nodes)
void Tree::PrintLevel(char* outFile, int levelNum)
{
	char outName[STR_LEN];
	sprintf(outName, "%s_tree_clusters.txt", outFile);
	int i;
	int levelN = levelNum;
	int numMotifs = Plat->GetMatCount();
	if(levelN>numMotifs){levelN=numMotifs;}
	int numAdded=0;
	TreeNode* tmpNode;
	TreeNode** nodes = new TreeNode*[numMotifs];
	double* edgeLen = new double[numMotifs];
	FILE* LEVOUT = fopen(outName, "w");

	//Initialize with the root
	nodes[numAdded]=root;
	edgeLen[numAdded]=0;
	numAdded++;

	while(numAdded < levelN){
		//Look through the added nodes' children for the shortest edge
		int shortest;
		double length =10000000;
		for(i=0; i<numAdded; i++){
			if(nodes[i]->left!=NULL && nodes[i]->right!=NULL){
				//if((edgeLen[i]+fabs(nodes[i]->left->edge)) < length || (edgeLen[i]+fabs(nodes[i]->right->edge)) < length){shortest=i;length = edgeLen[i];}
				if(edgeLen[i] < length){shortest=i; length = edgeLen[i];}
			}
		}

		//Shift the nodes to make room for another (this keeps all similar nodes together)
		for(i=numAdded; i>shortest+1; i--){
			nodes[i]=nodes[i-1];
			edgeLen[i]=edgeLen[i-1];
		}

		//Replace the shortest with both children
		tmpNode = nodes[shortest];
		double tmpEd = edgeLen[shortest];
		nodes[shortest] = tmpNode->left;
		edgeLen[shortest] = tmpEd+fabs(tmpNode->left->edge);
		nodes[shortest+1] = tmpNode->right;
		edgeLen[shortest+1] = tmpEd+fabs(tmpNode->right->edge);
		numAdded++;
	}

	//print the nodes
	for(i=0; i<numAdded; i++){
		PrintNode(nodes[i], LEVOUT);
	}

	delete [] nodes;
	delete [] edgeLen;
	fclose(LEVOUT);
}

////////////////////////////////////////////////////////////////
///   Multiple Alignment Code Replication //////////////////////
////////////////////////////////////////////////////////////////

//Postorder traversal of tree to make the alignments
void Tree::PPAAlignment(TreeNode* n, TreeNode* start, int leaveOutID)
{
	int a, b, z, i1, i2, aL, last0, last1, antiZ;
	bool forward1, forward2; double score, sum;
	AlignRec* aH = new AlignRec();
	char tmpName[STR_LEN];


	if(n->left != NULL){PPAAlignment(n->left, start);}
	if(n->right != NULL){PPAAlignment(n->right, start);}
	if(n->leaf){
		//Profile already defined, make the alignment correspond to the profile (i.e. no gaps)
		if(n->alignment!=NULL)
			delete n->alignment;
		n->alignment = new MultiAlignRec(1, n->profile->GetLen());
		strcpy(n->alignment->alignedNames[0], n->profile->name);
		strcpy(n->alignment->profileAlignment[0]->name, n->profile->name);
		n->alignment->alignedIDs[0] = n->leafID;
		//Fill alignSection
		//printf("%s\t%d\n", n->profile->name, n->profile->GetLen());
		for(z=0; z<n->profile->GetLen(); z++)
			for(b=0; b<B; b++)
				n->alignment->profileAlignment[0]->f[z][b]=n->profile->f[z][b];
		//PrintMultipleAlignmentConsensus(n->alignment);
	//	printf("leaf %s = %s\n",n->alignment->alignedNames[0], Plat->inputMotifs[n->alignment->alignedIDs[0]]->name);
	}

	if(!n->leaf)// && n->left->leaf && n->right->leaf)
	{
		Motif* revOne = new Motif(n->left->profile->GetLen());
		n->left->profile->RevCompMotif(revOne);
		Motif* revTwo = new Motif(n->right->profile->GetLen());
		n->right->profile->RevCompMotif(revTwo);
		Motif* curr1;	Motif* curr2;

		n->members = n->left->members + n->right->members;
		score = Aman->AlignMotifs2D(n->left->profile, n->right->profile, i1, i2, aL, forward1, forward2);
		if(forward1){curr1=n->left->profile;}
		else{curr1=revOne;}//printf("*R1*");}
		if(forward2){curr2=n->right->profile;}
		else{curr2 = revTwo;}//printf("*R2*");}

		//Align and copy the basic (pairwise) alignment to the place holder
		if(n->alignment!=NULL)
			delete n->alignment;
		n->alignment = new MultiAlignRec(n->members, aL);
		aH->CopyAlignSec(Aman->alignSection, aL);

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
		//test
//		PrintMultipleAlignmentConsensus(n->alignment);

		//working from the multiple alignment, reconstruct the new profile
		sprintf(tmpName, "Internal_%d", n->nodeID);
		if(n->profile!=NULL)
			delete n->profile;
		n->profile = Alignment2SWFBP(n->alignment, tmpName, leaveOutID);
		//Profile constructed!
		//test
//		printf("%s = %s vs %s : \n", n->profile->name, curr1->name, curr2->name);
//		for(z=0; z<aL; z++)
//			printf("%c", n->profile->ColConsensus(z));
//		printf("\n\n");

		delete revOne;
		delete revTwo;
	}
	delete aH;
}

//Convert a multiple alignment to a profile
Motif* Tree::Alignment2Profile(MultiAlignRec* alignment, const char* name, int leaveOutID)
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
			if(alignment->alignedIDs[x]!=leaveOutID){
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
		}
		for(b=0; b<B; b++)
		{	//printf("%lf\t%lf\n", newProfile->f[z][b], sum);
			newProfile->f[z][b] = newProfile->f[z][b]/sum;
		}
	}

	Plat->f_to_n(newProfile);
	Plat->n_to_pwm(newProfile);
	return(newProfile);
}

//Convert a multiple alignment to a Sandelin & Wasserman FBP
Motif* Tree::Alignment2SWFBP(MultiAlignRec* alignment, const char* name, int leaveOutID)
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
		if(newProfile->members==1){currW=1;}else{
		if(alignment->alignedIDs[x]!=leaveOutID){
		for(y=0; y<alignment->GetNumAligned(); y++){
			if(x!=y){
				currW += Plat->pairwiseAlign[alignment->alignedIDs[x]][alignment->alignedIDs[y]].p_value;
			}
		}
		currW=currW/alignment->GetNumAligned();
		}}
		weightings[x]=currW;// printf("%d %s %lf\n", x,Plat->inputMotifs[alignment->alignedIDs[x]]->GetName(), currW);
	}

	for(z=0; z<alignL; z++){
		sum=0;
		for(x=0; x<alignment->GetNumAligned(); x++){
			if(alignment->profileAlignment[x]->f[z][0] == -1 && alignment->alignedIDs[x]!=leaveOutID){
				newProfile->gaps[z]+=1;
			}else{
				for(b=0; b<B; b++){
					newProfile->f[z][b] += alignment->profileAlignment[x]->f[z][b]*weightings[x];
					sum+=alignment->profileAlignment[x]->f[z][b]*weightings[x];
				}
			}
		}
		for(b=0; b<B; b++)
		{	//printf("%lf\t%lf\n", newProfile->f[z][b], sum);
			newProfile->f[z][b] = newProfile->f[z][b]/sum;
		}
	}
	double maxIC=0;
	double currIC=0;
	int startWin=0, stopWin=alignL-1;

	//now scan either side of the alignment, deleting columns as necessary
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
	if(leaveOutID==-100){
		//Alignment Individuals prints
		for(x=0; x<alignment->GetNumAligned(); x++){
			printf(">\t%s\t%lf\n", alignment->alignedNames[x], weightings[x]);
			for(b=0; b<B; b++){
				for(j=mStart; j<=mStop; j++){
					printf("%lf\t", alignment->profileAlignment[x]->f[j][b]);
				}printf("\n");
			}
		}
	}

	strcpy(newProfile->name, name);
	delete [] weightings;
	Plat->f_to_n(newProfile);
	Plat->n_to_pwm(newProfile);
	return(newProfile);
}

//Iterative Refinement Multiple Alignment
void Tree::IRAlignment(TreeNode* curr, int leaveOutID)
{
	int i, j,b,z, minA=curr->progeny->mID, minB=curr->progeny->next->mID;
	int i1, i2, aL;
	bool forward1, forward2;
	double minDist = 1000000, currDist;
	int nM = curr->members;
	MultiAlignRec* alignment;
	Motif* currProfile=NULL;
	Motif* tmpProfile;
	bool* processed = new bool[Plat->GetMatCount()];
	for(i=0; i<Plat->GetMatCount(); i++)
		processed[i]=false;

	if(nM==2 && (minA==leaveOutID || minB==leaveOutID)){
		int adder;
		if(minA==leaveOutID){adder = minB;
		}else{adder= minA;
		}
		alignment = new MultiAlignRec(1, Plat->inputMotifs[adder]->GetLen());
		strcpy(alignment->alignedNames[0], Plat->inputMotifs[adder]->name);
		strcpy(alignment->profileAlignment[0]->name, Plat->inputMotifs[adder]->name);
		alignment->alignedIDs[0] = adder;
		//Fill initial alignment with sequence minA
		for(z=0; z<Plat->inputMotifs[adder]->GetLen(); z++)
			for(b=0; b<B; b++)
				alignment->profileAlignment[0]->f[z][b]=Plat->inputMotifs[adder]->f[z][b];
		if(currProfile!=NULL)
			delete currProfile;
		currProfile = Alignment2Profile(alignment, "current");
	}else{
	//Step 1: Find the most similar pair
	Child* tmpA; Child* tmpB;
	for(tmpA=curr->progeny; tmpA!=NULL; tmpA=tmpA->next){//printf("%s_%s\t", tmpA->m->famName, tmpA->m->name);
		for(tmpB=curr->progeny; tmpB!=NULL; tmpB=tmpB->next){
			if(tmpA->mID!=tmpB->mID && tmpA->mID!=leaveOutID && tmpB->mID!=leaveOutID){
				currDist=Plat->pairwiseAlign[tmpA->mID][tmpB->mID].dist;
				if(currDist < minDist){
					minDist = Plat->pairwiseAlign[tmpA->mID][tmpB->mID].dist;
					minA=tmpA->mID; minB=tmpB->mID;
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
	Child* x; Child* y;
	for(int q=0; q<nM-2; q++){
		//Find the most similar profile in the remaining motifs
		minDist = 1000000;
		for(y=curr->progeny; y!=NULL; y=y->next){
			if(!processed[y->mID]){
				currDist = Aman->AlignMotifs2D(currProfile, Plat->inputMotifs[y->mID], i1, i2, aL, forward1, forward2);
				if(currDist < minDist){
					minDist = currDist;
					minA=y->mID;
		}	}	}
		//Add the lowest distance to the alignment
		if(minA!=leaveOutID){
			alignment = SingleProfileAddition(alignment, Plat->inputMotifs[minA], minA);
			if(currProfile!=NULL)
				delete currProfile;
			currProfile = Alignment2Profile(alignment, "current");
		}
		processed[minA]=true;
	}

	//Step 3: Remove each motif from the alignment in turn, rebuild the multiple alignment and add in the motif again
	//Do this a fixed number of times
	for(int q=0; q<IR_MA_ITER; q++){
		for(y=curr->progeny; y!=NULL; y=y->next){
			if(y->mID!=leaveOutID){
				alignment = SingleProfileSubtraction(alignment, y->mID);
				alignment = SingleProfileAddition(alignment, Plat->inputMotifs[y->mID], y->mID);
				if(currProfile!=NULL)
					delete currProfile;
				currProfile = Alignment2Profile(alignment, "current");
			}
		}
	}
	}

	char tmpName[STR_LEN];
	sprintf(tmpName, "Internal_%d", curr->nodeID);
	if(curr->profile!=NULL)
		delete curr->profile;
	curr->profile = Alignment2SWFBP(alignment, tmpName, leaveOutID);
	curr->alignment=alignment;
}
//Align a single motif to an existing alignment
MultiAlignRec* Tree::SingleProfileAddition(MultiAlignRec* alignment, Motif* two, int twoID)
{
	int i1, i2, aL, last0, last1, antiZ, a, b, z;
	bool forward1, forward2; double score, sum;
	AlignRec* aH = new AlignRec();
	char tmpName[STR_LEN];
	Motif* one =NULL;
	MultiAlignRec* newAlignment;

	sprintf(tmpName, "Aligned_%d", alignment->GetNumAligned()+1);
	one = Alignment2Profile(alignment, "tmpName");
//printf("%d aligned, len %d\n", alignment->GetNumAligned(), alignment->GetAlignL());
	Motif* revOne = new Motif(one->GetLen());
	one->RevCompMotif(revOne);
	Motif* revTwo = new Motif(two->GetLen());
	two->RevCompMotif(revTwo);
	Motif* curr1;	Motif* curr2;
	score = Aman->AlignMotifs2D(one, two, i1, i2, aL, forward1, forward2);
	if(forward1){curr1=one;}
	else{curr1=revOne;}//printf("*R1*");}
	if(forward2){curr2=two;}
	else{curr2 = revTwo;}//printf("*R2*");}
	//Align and copy the basic (pairwise) alignment to the place holder
	newAlignment = new MultiAlignRec(alignment->GetNumAligned()+1, aL);
	aH->CopyAlignSec(Aman->alignSection, aL);


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
MultiAlignRec* Tree::SingleProfileSubtraction(MultiAlignRec* alignment, int removeID)
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


