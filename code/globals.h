//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// globals.h
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

//Global definitions
#ifndef GLOB_MARK
#define GLOB_MARK
#include <math.h>

const int B=4;
const int AA=20;
const int STR_LEN = 500;
const int LONG_STR=1000;
const double DFLT_NUM_INSTANCES=30.0;
const int MAX_MOTIFS = 10001;
const int MAX_MOTIF_LEN = 200;
const int MAX_MARKOV = 6;
const int maxLen = 25;
const int minLen = 5;
const double SCALE_FACTOR = 0.001;
const int MIN_OVERLAP =3;
const double DFLT_GAP_OPEN = 1.0;
const double DFLT_GAP_EXTEND = 0.5;
const bool DFLT_OVLP_ALIGN= true;
const double LOG_2 = log(2.0);
const double DFLT_MIN_SCORE = -1;
const int minFBPLen=6;
const int NUM_INTEG = 1000; //number of iterations for integration in p_value calculation
const int RAND_MUTI_N=100000;
const int IR_MA_ITER=50;
const int IC_win_len=4;
const double MIN_INFO=0.4;
const double SQRT_2_PI = sqrt(2*M_PI);
const double Euler_Mascheroni = 0.577215664901532860606512090082402431042159335;
const int TOP_MATCH = 5;

#endif
