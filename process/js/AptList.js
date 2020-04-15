var React = require('react');

var AptList = React.createClass({
  handleDelete: function() {
    this.props.onDelete(this.props.whichItem);
  },
  handleEdit: function() {
    this.props.onEdit(this.props.whichItem);
  },
  handleRun: function() {
    this.props.onRun(this.props.whichItem);
  },
  render: function() {
    let params = '';
    if (this.props.singleItem.allowParams == 'true') {
      params = ' [params]';
    } else {
      params = ''
    }
    return(
      <li className="pet-item media">
        <div className="media-left">
          <button className="pet-delete btn btn-xs btn-danger" onClick={this.handleDelete}>
          <span className="glyphicon glyphicon-remove"></span></button>
        </div>
        <div className="media-left">
          <button className="pet-edit btn btn-xs btn-primary" onClick={this.handleEdit}>
          <span className="glyphicon glyphicon-pencil"></span></button>
        </div>
        <div className="media-left">
          <button className="pet-edit btn btn-xs btn-success" onClick={this.handleRun}>
          <span className="glyphicon glyphicon-play"></span></button>
        </div>
        <div className="pet-info media-body">
          <div className="pet-head">
            <span className="pet-name">{this.props.singleItem.trigger}</span>
            <span className="apt-date pull-right">{this.props.singleItem.voice}</span>
            <p></p>
            <span className="apt-date pull-right">{this.props.singleItem.ground}</span>
          </div>
          <div className="owner-name"><span className="label-item">Command:</span>
            {this.props.singleItem.command}{params}</div>
          <div className="apt-notes">{this.props.singleItem.aptNotes}</div>
        </div>
      </li>
    )
  }
});

module.exports = AptList;
