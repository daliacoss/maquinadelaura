import React, { Component } from 'react';
import update from "immutability-helper";
import logo from './logo.svg';
import './App.css';

const BehaviorEnum = Object.freeze({
    TriggerLeft: 1,
    TriggerRight: 2,
    TriggerUp: 3,
    TriggerDown: 4,
})

function newCellData(){
    return {
        playing: false,
        behaviors: {
            onTrigger: [
                Math.ceil(Math.random() * BehaviorEnum.TriggerDown)
            ]
        }
    };
}

class App extends Component {
    render() {
        return (
          <div className="App">
            <p>Hello world!</p>
            <Matrix width="600px" height="600px" numRows={5} numCols={5}/>
          </div>
        );
    }
}

class Matrix extends Component {

    constructor(props) {
        super(props);

        let _state = {queue: []};
        for (let i = 0; i < this.props.numRows; i++){
            // let row = {};
            for (let j = 0; j < this.props.numCols; j++){
                _state[(i * this.props.numCols) + j] = newCellData();
            }
            // _state[i] = row;
        }
        this.state = _state;
        this.handleCellPress = this.handleCellPress.bind(this);
        this.playStep = this.playStep.bind(this);
    }
    
    handleCellPress(cell, e){
        let index = (cell.props.row * this.props.numCols) + cell.props.col;

        this.setState((prevState) => {
            return update(prevState, {
                queue: {$push: [index]}
            });
        });
        // this.triggerCell(index, true);
    }
    
    playStep(){
        this.setState((prevState) => {
            let newState = {};
            let newQueue = [];
            
            for (let k in prevState.queue){
                let index = prevState.queue[k];
                let prevCellState = prevState[index];

                for (let i in prevCellState.behaviors.onTrigger){
                    let behavior = prevCellState.behaviors.onTrigger[i];
                    let cellToQueue = -1;
                    
                    switch (behavior){
                        case BehaviorEnum.TriggerLeft:
                            cellToQueue = (index % this.props.numCols) ? index - 1 : cellToQueue;
                            break;
                        case BehaviorEnum.TriggerRight:
                            cellToQueue = (index % this.props.numCols !== this.props.numCols - 1) ? index + 1 : cellToQueue; 
                            break;
                        case BehaviorEnum.TriggerUp:
                            cellToQueue = (index >= this.props.numCols) ? index - this.props.numCols : cellToQueue;
                            break;
                        case BehaviorEnum.TriggerDown:
                            cellToQueue = (index < (this.props.numRows - 1) * this.props.numCols) ? index + this.props.numCols : cellToQueue;
                            break;
                    }
                    
                    if (cellToQueue >= 0){
                        newQueue.push(cellToQueue);
                    }
                }
                newState[index] = update(prevCellState, {
                    playing: {$apply: (x) => !x}
                });
            }
            
            newState.queue = newQueue;
            return newState;
        });
    }

    render() {

        let cells = [];

        for (let i = 0; i < this.props.numRows; i++){
            for (let j = 0; j < this.props.numCols; j++){
                cells.push(
                    <Cell row={i} col={j}
                    key={i.toString() + "-" + j.toString()}
                    onPress={this.handleCellPress}
                    myProp={this.state[(i * this.props.numCols) + j].playing}/>
                );
            }
        }

        return (
            <div>
                <svg className="Matrix" width={this.props.width} height={this.props.height}>
                    { cells }
                </svg>
                <br/>
                <button onClick={this.playStep}>next step</button>
            </div>
        )
    }
}

class Cell extends Component {

    constructor(props) {
        super(props);

        this.getPos = this.getPos.bind(this);
        this.handlePress = this.handlePress.bind(this);
        // this.state = {myState: false};
    }

    getPos() {
        return {x: this.props.col * 15, y: this.props.row * 15};
    }

    handlePress(e) {
        // this.setState((prevState) => ({
        //     myState: ! prevState.myState
        // }));
        this.props.onPress(this, e);
    }

    render() {
        let pos = this.getPos();

        return (
            <rect className="Cell"
            x={pos.x.toString() + "%"}
            y={pos.y.toString() + "%"}
            width="10%"
            height="10%"
            fill={(this.props.myProp) ? "red" : "blue"}
            onMouseDown={this.handlePress} />
        )
    }
}

export default App;
