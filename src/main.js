/** @jsx React.DOM */
(function(React, postal, $) {
    // We need to tell postal how to get a deferred instance
    postal.configuration.promise.createDeferred = function() {
        return new $.Deferred();
    };
    // We need to tell postal how to get a "public-facing"/safe promise instance
    postal.configuration.promise.getPromise = function(dfd) {
        return dfd.promise();
    };
    
    var dataMixin = {
        requestData: function() {
            var self = this;
            postal.channel(self.props.namespace).request({
                topic: "read",
                data: {
                    id: this.props.id
                },
                timeout: this.props.timeout || 2000
            }).then(function(data) {
                self.setState(data);
            });
        }
    };
    
    var msgMixin = {
        componentDidMount: function() {
            this.subscriptions = {};
        },
        publish: function(topic, data) {
            postal.publish({
                channel: this.props.namespace,
                topic : topic,
                data : data
            });
        },
        subscribe: function(topic, callback) {
            if(!this.subscriptions[topic]) {
                this.subscriptions[topic] = postal.subscribe({
                    channel: this.props.namespace,
                    topic: topic,
                    callback: callback
                }).withContext(this);
            }
        }
    };

    $.mockjax({
        url: '/worksheet/2014-05',
        contentType: "text/json",
        responseTime: 100,
        responseText: {
            period : "May 2014",
            items  : [
                { 
                    description : "Rent",
                    type        : "expense",
                    budget      : 1600,
                    actual      : 1600
                },
                {
                    description : "Salary",
                    type        : "income",
                    budget      : 5300,
                    actual      : 4875
                },
                { 
                    description : "Groceries",
                    type        : "expense",
                    budget      : 800,
                    actual      : 650
                }
            ]
        }
    });
    
    var budgetDataSrc = (function(){
        var dataSrc = {
            read: function(data, env) {
                var url = "/worksheet/" + data.id;
                $.ajax({
                    url: url,
                    dataType: 'json'
                }).then(function(data) {
                    env.reply(data);
                });
            }
        };
        
        postal.subscribe({
            channel: "worksheet",
            topic: "#",
            callback: function(data, env) {
                if(dataSrc.hasOwnProperty(env.topic)) {
                    dataSrc[env.topic](data, env);
                } else {
                    console.log("No such operation exists on the budget datasource:" + env.topic);
                }
            }
        });
        
        return dataSrc;
    }());

    var Item = React.createClass({
        mixins: [msgMixin],
        onChange : function(e) {
            var $el = $(e.currentTarget);
            var type = $el.parent().hasClass("actual") ? "actual" : "budget";
            var data = {
                index: this.props.index,
                type : type,
                val  : Number.parseFloat($el.val())
            };
            this.publish("item.change", data);
        },
        render: function() {
            return  <div className="row budget-item">
                        <div className="col-xs-4 col-sm-4 col-md-4 col-lg-6 desc"> { this.props.description }</div>
                        <div className="col-xs-4 col-sm-4 col-md-4 col-lg-3 budget">
                            <input type="text" value={ this.props.budget } onChange={ this.onChange }/>
                        </div>
                        <div className="col-xs-4 col-sm-4 col-md-4 col-lg-3 actual">
                            <input type="text" value={ this.props.actual } onChange={ this.onChange } />
                        </div>
                    </div>;
        }
    });

    var ItemAdd = React.createClass({
        mixins: [msgMixin],
        addItem: function(e) {
            e.preventDefault();
            var data = {
                description : $("#item_desc").val(),
                type        : $("#item_type").val(),
                budget      : Number.parseFloat($("#item_budget").val()),
                actual      : Number.parseFloat($("#item_actual").val())
            };
            this.publish("item.add", data);
        },

        render: function() {
            return  <div className="budget-item-add">
                        <div className="row budget-item">
                            <div className="col-xs-4 col-sm-4 col-md-4 col-lg-6 desc">
                                <input type="text" id="item_desc" placeholder="description" />
                            </div>
                            <div className="col-xs-4 col-sm-4 col-md-4 col-lg-3">
                                <input type="text" id="item_budget" placeholder="budget"/>
                            </div>
                            <div className="col-xs-4 col-sm-4 col-md-4 col-lg-3">
                                <input type="text" id="item_actual" placeholder="actual"/>
                            </div>
                        </div>
                        <div className="row budget-item ctrls">
                            <div className="col-xs-4 col-sm-4 col-md-4 col-lg-6 desc">
                                <select id="item_type">
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                            </div>
                            <div className="col-xs-8 col-sm-8 col-md-8 col-lg-6">
                                <button name="addItem" className="btn btn-default" onClick={this.addItem}>Add</button>
                            </div>
                        </div>
                    </div>;
        }
    });

    var Summary = React.createClass({
        render: function() {
            return <div className={ "summary " + this.props.type + " panel panel-default" }>
                <div className="row">
                    <div className="col-xs-12 summary-header">
                        <h3>{ this.props.type.charAt(0).toUpperCase() + this.props.type.slice(1) } </h3>
                    </div>
                    <div className="panel-body">
                        <div className="row">
                            <div className="col-xs-6">Income:</div>
                            <div className="col-xs-6 amount">{ accounting.formatMoney(this.props.income) }</div>
                        </div>
                        <div className="row">
                            <div className="col-xs-6">Expense:</div>
                            <div className="col-xs-6 amount">{ accounting.formatMoney(this.props.expense) }</div>
                        </div>
                        <div className="row remainder">
                            <div className="col-xs-6">Remainder:</div>
                            <div className="col-xs-6 amount">{ accounting.formatMoney(this.props.remainder) }</div>
                        </div>
                    </div>
                </div>
            </div>
        }
    });

    var Worksheet = React.createClass({
        getInitialState: function(){
            return {
                period : "",
                items  : [],
                budgetExpense  : function() {
                    return this.items.reduce(function(accum, val){
                      return val.type === "expense" ? accum + val.budget : accum;
                    }, 0);
                },
                budgetIncome    : function() {
                    return this.items.reduce(function(accum, val){
                      return val.type === "income" ? accum + val.budget : accum;
                    }, 0);
                },
                budgetRemainder : function() {
                    return this.budgetIncome() - this.budgetExpense()
                },
                actualExpense  : function() {
                    return this.items.reduce(function(accum, val){
                      return val.type === "expense" ? accum + val.actual : accum;
                    }, 0);
                },
                actualIncome    : function() {
                    return this.items.reduce(function(accum, val){
                      return val.type === "income" ? accum + val.actual : accum;
                    }, 0);
                },
                actualRemainder : function() {
                    return this.actualIncome() - this.actualExpense()
                }
            };
        },
        
        mixins: [msgMixin, dataMixin],

        componentDidMount: function() {
            this.requestData();
            this.subscribe(
                "item.add",
                function(data, env) {
                    this.addNewItem(data);
                }
            );
            this.subscribe(
                "item.change",
                function(data, env) {
                    this.updateItem(data.index, data.type, data.val);
                }
            );
        },

        updateItem: function(index, type, val) {
            var items = this.state.items.slice(0);
            items[index][type] = val;
            this.setState({ items: items });
        },

        addNewItem: function(item) {
            var items = this.state.items.concat([item]);
            this.setState({ items: items });
        },

        render: function() {
            var ns = this.props.namespace;
            return  <div className="container-fluid">
                        <form>
                        <div className="row">
                            <div className="col-xs-12 col-sm-12 col-md-12 col-lg-12 page-header worksheet-title">
                                <h1>{ this.state.period }</h1>
                            </div>
                        </div> 
                        <div className="row">
                            <div className="items col-xs-10 col-sm-6 col-md-4 col-lg-4">
                                <div className="row budget-item">
                                    <div className="col-xs-4 col-sm-4 col-md-4 col-lg-6 header">Description</div>
                                    <div className="col-xs-4 col-sm-4 col-md-4 col-lg-3 header amount ">Budget</div>
                                    <div className="col-xs-4 col-sm-4 col-md-4 col-lg-3 header amount">Actual</div>
                                </div>
                                {
                                    this.state.items.map(function(i, idx) {
                                        return <Item key={idx} index={idx} description={i.description} budget={i.budget} actual={i.actual} namespace={ns} />;
                                    })
                                }
                                <ItemAdd namespace="worksheet" />
                            </div>
                            <div className="col-xs-10 col-sm-3 col-md-3 col-lg-2">
                                <Summary type="budget"
                                         income={ this.state.budgetIncome() }
                                         expense={ this.state.budgetExpense() }
                                         remainder={ this.state.budgetRemainder() } />
                                <Summary type="actual"
                                         income={ this.state.actualIncome() }
                                         expense={ this.state.actualExpense() }
                                         remainder={ this.state.actualRemainder() } />
                            </div>
                        </div>
                        </form>
                    </div>;
        }
    });

    var worksheet = <Worksheet id="2014-05" namespace="worksheet" />;

    React.renderComponent(
        worksheet,
        document.body
    );
}(React, postal, jQuery));